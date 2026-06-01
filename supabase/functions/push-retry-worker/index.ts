import { createClient } from 'jsr:@supabase/supabase-js@2';

// 재시도 워커 — 매시간 cron 실행
// retry_pending & next_retry_at <= now 행을 모아 다시 Expo로 발송한다.
// attempts >= 5에서는 dead 처리. 새 ticket이 발급되면 status='pending'으로 돌려보내
// receipt-poller가 다음 라운드에서 확인하도록 한다.

const PERMANENT_ERRORS = ['DeviceNotRegistered', 'MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'];
const BACKOFF_MIN = [5, 30, 120, 360, 1440]; // 1→2→3→4→5번째 시도 직후 대기(분)
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 100; // Expo Push: 1요청 ≤ 100건

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('push_delivery_logs')
    .select('id, user_id, notice_id, expo_token, attempts, payload')
    .eq('status', 'retry_pending')
    .lte('next_retry_at', nowIso)
    .order('next_retry_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[retry-worker] DB 조회 실패:', error.message);
    return new Response('error', { status: 500 });
  }
  if (!rows?.length) {
    return json({ retried: 0, message: 'no rows to retry' });
  }

  // attempts >= 5는 즉시 dead로 이동
  const deadIds: string[] = [];
  const targets: typeof rows = [];
  for (const r of rows) {
    if (r.attempts >= MAX_ATTEMPTS) deadIds.push(r.id);
    else targets.push(r);
  }

  if (deadIds.length) {
    await supabase
      .from('push_delivery_logs')
      .update({ status: 'dead' })
      .in('id', deadIds);
  }

  if (!targets.length) {
    return json({ retried: 0, dead: deadIds.length });
  }

  // Expo Push API에 한 번에 발송
  const messages = targets.map(r => {
    const p = r.payload ?? {};
    return {
      to: r.expo_token,
      title: '📢 manaba 新着通知',
      body:  p.subject ?? '',
      data:  p,
      sound: 'default',
    };
  });

  let tickets: any[] = [];
  let httpOk = true;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      httpOk = false;
      console.error('[retry-worker] Expo HTTP 실패:', res.status, await res.text());
    } else {
      const j = await res.json();
      tickets = Array.isArray(j?.data) ? j.data : [];
    }
  } catch (e) {
    httpOk = false;
    console.error('[retry-worker] 네트워크 예외:', e);
  }

  let pending = 0, perm = 0, retried = 0;

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    const nextAttempts = r.attempts + 1;
    const t = tickets[i];

    if (!httpOk || !t) {
      // 전체 HTTP 실패 → 다시 다음 단계 백오프로
      retried++;
      const minutes = BACKOFF_MIN[Math.min(nextAttempts - 1, BACKOFF_MIN.length - 1)];
      await supabase
        .from('push_delivery_logs')
        .update({
          attempts: nextAttempts,
          last_error_code: 'NETWORK',
          last_error_msg: 'Expo HTTP/network failure',
          next_retry_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
          status: nextAttempts >= MAX_ATTEMPTS ? 'dead' : 'retry_pending',
        })
        .eq('id', r.id);
      continue;
    }

    if (t.status === 'ok') {
      pending++;
      await supabase
        .from('push_delivery_logs')
        .update({
          ticket_id: t.id,
          status: 'pending',
          attempts: nextAttempts,
          last_error_code: null,
          last_error_msg: null,
          next_retry_at: null,
        })
        .eq('id', r.id);
      continue;
    }

    // status === 'error'
    const code = t?.details?.error ?? 'UNKNOWN';
    const msg  = t?.message ?? '';

    if (PERMANENT_ERRORS.includes(code)) {
      perm++;
      if (code === 'DeviceNotRegistered') {
        await supabase.from('push_tokens').delete().eq('expo_token', r.expo_token);
      }
      await supabase
        .from('push_delivery_logs')
        .update({
          status: 'permanent_fail',
          attempts: nextAttempts,
          last_error_code: code,
          last_error_msg: msg,
          next_retry_at: null,
        })
        .eq('id', r.id);
    } else {
      retried++;
      const minutes = BACKOFF_MIN[Math.min(nextAttempts - 1, BACKOFF_MIN.length - 1)];
      await supabase
        .from('push_delivery_logs')
        .update({
          attempts: nextAttempts,
          last_error_code: code,
          last_error_msg: msg,
          next_retry_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
          status: nextAttempts >= MAX_ATTEMPTS ? 'dead' : 'retry_pending',
        })
        .eq('id', r.id);
    }
  }

  return json({ processed: targets.length, pending, retried, perm, dead: deadIds.length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
