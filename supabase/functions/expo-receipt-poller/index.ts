import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isCronAllowed, forbidden } from '../_shared/cronAuth.ts';

// Expo Push receipts 폴러
// 15분마다 cron 실행. pending 상태(15분 이상 경과) ticket들을 모아
// Expo /push/getReceipts에 조회 → status를 delivered / retry_pending / permanent_fail로 갱신.
//
// 왜 15분 후인가: Expo는 receipt 생성에 최대 수 분이 걸리고 30분 후엔 삭제된다.
// 너무 빨리 조회하면 'pending'이 비어있고, 너무 늦으면 receipt이 사라진다.

const PERMANENT_ERRORS = ['DeviceNotRegistered', 'MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'];
const BATCH_SIZE = 1000; // Expo receipts API: 1요청 최대 1000건

Deno.serve(async (req: Request) => {
  // 자동 작업(pg_cron)만 실행 가능 — 외부인이 공개 열쇠로 부르면 거절 (2026-11-18)
  if (!(await isCronAllowed(req))) return forbidden();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 15분 이상 지난 pending 행 수집
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from('push_delivery_logs')
    .select('id, ticket_id, expo_token')
    .eq('status', 'pending')
    .lte('created_at', fifteenMinAgo)
    .not('ticket_id', 'is', null)
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[receipt-poller] DB 조회 실패:', error.message);
    return new Response('error', { status: 500 });
  }
  if (!rows?.length) {
    return json({ checked: 0, message: 'no pending tickets' });
  }

  // ticket_id → row id 매핑
  const byTicket = new Map<string, { id: string; expo_token: string }>();
  for (const r of rows) {
    if (r.ticket_id) byTicket.set(r.ticket_id, { id: r.id, expo_token: r.expo_token });
  }
  const ticketIds = Array.from(byTicket.keys());

  // Expo receipts 조회
  let receipts: Record<string, any> = {};
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ticketIds }),
    });
    if (!res.ok) {
      console.error('[receipt-poller] Expo API 실패:', res.status, await res.text());
      return new Response('error', { status: 502 });
    }
    const json = await res.json();
    receipts = json?.data ?? {};
  } catch (e) {
    console.error('[receipt-poller] 네트워크 예외:', e);
    return new Response('error', { status: 502 });
  }

  let delivered = 0, retried = 0, dead = 0, missing = 0;

  for (const ticketId of ticketIds) {
    const meta = byTicket.get(ticketId)!;
    const receipt = receipts[ticketId];

    // receipt가 없으면 (만료/없음) → 다시 한 번 retry로 돌림 (5분 후)
    if (!receipt) {
      missing++;
      await supabase
        .from('push_delivery_logs')
        .update({
          status: 'retry_pending',
          last_error_code: 'RECEIPT_MISSING',
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', meta.id);
      continue;
    }

    if (receipt.status === 'ok') {
      delivered++;
      await supabase
        .from('push_delivery_logs')
        .update({ status: 'delivered' })
        .eq('id', meta.id);
      continue;
    }

    // receipt.status === 'error'
    const code = receipt?.details?.error ?? 'UNKNOWN';
    const msg  = receipt?.message ?? '';

    if (PERMANENT_ERRORS.includes(code)) {
      dead++;
      if (code === 'DeviceNotRegistered') {
        await supabase.from('push_tokens').delete().eq('expo_token', meta.expo_token);
      }
      await supabase
        .from('push_delivery_logs')
        .update({
          status: 'permanent_fail',
          last_error_code: code,
          last_error_msg: msg,
        })
        .eq('id', meta.id);
    } else {
      retried++;
      await supabase
        .from('push_delivery_logs')
        .update({
          status: 'retry_pending',
          last_error_code: code,
          last_error_msg: msg,
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', meta.id);
    }
  }

  return json({ checked: ticketIds.length, delivered, retried, dead, missing });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
