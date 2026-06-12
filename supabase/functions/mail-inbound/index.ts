import { createClient } from 'jsr:@supabase/supabase-js@2';

// 메일전달 방식 푸시의 수신 엔드포인트.
// Cloudflare Email Worker가 학생의 manaba 알림 메일을 파싱한 뒤 이 함수를 호출한다.
//   호출자: Worker만 (x-mail-secret 공유시크릿으로 검증, verify_jwt:false)
//   흐름: forward_token으로 학생 식별 → manaba_notices 저장(중복 차단) → Expo 푸시
// 기존 ms-graph-webhook의 sendExpoPush/extractManabaUrl 로직을 그대로 이식.

// manaba 알림 메일 허용 발신자 도메인 (src/constants/universities.js 학교 추가 시 함께 추가)
const ALLOWED_SENDERS = [
  'kokushikan.manaba.jp',
  'manaba.jp',
];

const MAIL_INBOUND_SECRET = Deno.env.get('MAIL_INBOUND_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mail-secret',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ① 공유시크릿 검증 — Worker 외의 호출 차단
  if (!MAIL_INBOUND_SECRET || req.headers.get('x-mail-secret') !== MAIL_INBOUND_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  try {
    const { token, subject, fromAddress, bodyHtml, receivedAt } = await req.json();
    if (!token) return new Response('no token', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ② forward_token으로 학생 식별
    const { data: sub } = await supabase
      .from('mail_subscriptions')
      .select('user_id, verified_at')
      .eq('forward_token', token)
      .maybeSingle();

    if (!sub) {
      console.warn('[mail-inbound] 알 수 없는 forward_token — 무시');
      return new Response('no subscription', { status: 204 });
    }

    // ③ 발신자 도메인 재검증 — manaba 외 메일은 무시 (가짜 푸시 차단)
    const senderEmail = (fromAddress ?? '').toLowerCase();
    const senderDomain = senderEmail.split('@')[1] ?? '';
    if (!ALLOWED_SENDERS.some((d) => senderDomain.endsWith(d))) {
      console.warn('[mail-inbound] 비허용 발신자 — 무시:', senderDomain);
      return new Response('sender not allowed', { status: 204 });
    }

    // ④ 전달이 실제로 작동함을 확인 → verified_at 1회 세팅 (온보딩·프로필 ✅ 표시용)
    if (!sub.verified_at) {
      await supabase
        .from('mail_subscriptions')
        .update({ verified_at: new Date().toISOString() })
        .eq('user_id', sub.user_id);
    }

    // ⑤ 본문에서 manaba 공지 URL 추출
    const html: string = bodyHtml ?? '';
    const noticeUrl = extractManabaUrl(html);
    const receivedIso = receivedAt ?? new Date().toISOString();

    // ⑥ manaba_notices 저장 (UNIQUE(user_id, notice_url)로 중복 푸시 방지)
    const { data: notice, error: insertErr } = await supabase
      .from('manaba_notices')
      .insert({
        user_id:     sub.user_id,
        subject:     subject ?? '',
        sender:      senderEmail,
        received_at: receivedIso,
        body_html:   html,
        notice_url:  noticeUrl,
        pushed_at:   new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr?.code === '23505') {
      console.log('[mail-inbound] 중복 공지 — 푸시 생략:', noticeUrl);
      return new Response('duplicate', { status: 200 });
    }
    if (insertErr || !notice) {
      console.error('[mail-inbound] DB insert 실패:', insertErr?.message);
      return new Response('insert error', { status: 500 });
    }

    // ⑦ push_tokens 조회 후 Expo Push 발송
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', sub.user_id);

    if (tokens?.length) {
      await sendExpoPush(
        supabase,
        sub.user_id,
        notice.id,
        tokens.map((t) => t.expo_token),
        subject ?? '',
        html,
        noticeUrl,
      );
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('[mail-inbound] 예외:', e);
    return new Response('error', { status: 500 });
  }
});

/** 본문 HTML에서 manaba 공지 URL 추출 */
function extractManabaUrl(html: string): string | null {
  const match = html.match(/https?:\/\/[a-zA-Z0-9.-]*manaba\.jp[^\s"'<>]*/);
  return match ? match[0] : null;
}

/**
 * Expo Push API로 푸시 알림 발송 + push_delivery_logs 기록.
 * 응답의 tickets 배열은 요청 순서와 1:1 대응한다.
 * - ok    → status='pending' (15분 후 receipt 폴러가 delivered 판정)
 * - error → 영구실패는 즉시 permanent_fail, 그 외는 retry_pending
 */
async function sendExpoPush(
  supabase: any,
  userId: string,
  noticeId: string,
  tokens: string[],
  subject: string,
  bodyHtml: string,
  noticeUrl: string | null,
) {
  const payloadBase = { noticeId, subject, bodyHtml, noticeUrl };
  const messages = tokens.map((to) => ({
    to,
    title: '📢 manaba 新着通知',
    body: subject,
    data: payloadBase,
    sound: 'default',
  }));

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
      console.error('[mail-inbound] Expo Push HTTP 실패:', res.status, await res.text());
    } else {
      const jsonRes = await res.json();
      tickets = Array.isArray(jsonRes?.data) ? jsonRes.data : [];
    }
  } catch (e) {
    httpOk = false;
    console.error('[mail-inbound] Expo Push 네트워크 예외:', e);
  }

  const rows = tokens.map((expoToken, idx) => {
    const t = tickets[idx];

    if (!httpOk) {
      return {
        user_id: userId,
        notice_id: noticeId,
        expo_token: expoToken,
        ticket_id: null,
        status: 'retry_pending',
        attempts: 1,
        last_error_code: 'NETWORK',
        last_error_msg: 'Expo Push HTTP/network failure',
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        payload: payloadBase,
      };
    }

    if (t?.status === 'ok') {
      return {
        user_id: userId,
        notice_id: noticeId,
        expo_token: expoToken,
        ticket_id: t.id,
        status: 'pending',
        attempts: 1,
        payload: payloadBase,
      };
    }

    // status === 'error'
    const code = t?.details?.error ?? 'UNKNOWN';
    const msg = t?.message ?? '';
    const permanent = ['DeviceNotRegistered', 'MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'];

    if (permanent.includes(code)) {
      if (code === 'DeviceNotRegistered') {
        supabase.from('push_tokens').delete().eq('expo_token', expoToken).then(() => {});
      }
      return {
        user_id: userId,
        notice_id: noticeId,
        expo_token: expoToken,
        ticket_id: null,
        status: 'permanent_fail',
        attempts: 1,
        last_error_code: code,
        last_error_msg: msg,
        payload: payloadBase,
      };
    }

    return {
      user_id: userId,
      notice_id: noticeId,
      expo_token: expoToken,
      ticket_id: null,
      status: 'retry_pending',
      attempts: 1,
      last_error_code: code,
      last_error_msg: msg,
      next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      payload: payloadBase,
    };
  });

  const { error } = await supabase.from('push_delivery_logs').insert(rows);
  if (error) {
    console.error('[mail-inbound] push_delivery_logs insert 실패:', error.message);
  }
}
