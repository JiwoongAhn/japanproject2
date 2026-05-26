import { createClient } from 'jsr:@supabase/supabase-js@2';

// manaba 알림 메일을 보내는 허용 발신자 도메인
// src/constants/universities.js의 학교 추가 시 여기도 함께 추가
const ALLOWED_SENDERS = [
  'kokushikan.manaba.jp',
  'manaba.jp',
];

const WEBHOOK_CLIENT_STATE = Deno.env.get('WEBHOOK_CLIENT_STATE') ?? 'unipas-secret';
const MS_TENANT_ID = 'common';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Microsoft Graph가 webhook 등록 시 validationToken으로 진위 확인
  const url = new URL(req.url);
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken) {
    return new Response(validationToken, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const body = await req.json();
    const notifications = body?.value ?? [];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    for (const notification of notifications) {
      // clientState 검증 — 위조 webhook 차단
      if (notification.clientState !== WEBHOOK_CLIENT_STATE) {
        console.warn('[webhook] clientState 불일치 — 무시');
        continue;
      }

      const userId   = notification.resourceData?.['@odata.id'];  // 추후 user_id 매핑 필요
      const resource = notification.resource; // e.g. "Users/{id}/Messages/{messageId}"

      // ① 해당 사용자의 refresh_token 조회
      const messageId = resource?.split('/Messages/')?.[1];
      if (!messageId) continue;

      // resource에서 user 식별 → mail_subscriptions에서 refresh_token 조회
      const { data: sub } = await supabase
        .from('mail_subscriptions')
        .select('user_id, ms_refresh_token, ms_account_email')
        .eq('subscription_id', notification.subscriptionId)
        .maybeSingle();

      if (!sub) {
        console.warn('[webhook] subscription 없음:', notification.subscriptionId);
        continue;
      }

      // ② refresh_token으로 새 access_token 발급
      const accessToken = await refreshAccessToken(sub.ms_refresh_token, supabase, sub.user_id);
      if (!accessToken) continue;

      // ③ 메일 본문 가져오기
      const mailRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=subject,from,receivedDateTime,body`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!mailRes.ok) continue;

      const mail = await mailRes.json();
      const senderEmail: string = mail.from?.emailAddress?.address ?? '';

      // ④ 발신자 도메인 필터 — manaba 도메인만 처리
      const senderDomain = senderEmail.split('@')[1] ?? '';
      if (!ALLOWED_SENDERS.some(d => senderDomain.endsWith(d))) {
        continue; // manaba 외 메일은 무시
      }

      const subject: string  = mail.subject ?? '';
      const bodyHtml: string = mail.body?.content ?? '';
      const receivedAt       = mail.receivedDateTime;

      // ⑤ 본문에서 manaba 공지 URL 추출 (정규식)
      const noticeUrl = extractManabaUrl(bodyHtml);

      // ⑥ manaba_notices 저장 (중복 시 무시)
      const { error: insertErr } = await supabase
        .from('manaba_notices')
        .insert({
          user_id:     sub.user_id,
          subject,
          sender:      senderEmail,
          received_at: receivedAt,
          body_html:   bodyHtml,
          notice_url:  noticeUrl,
          pushed_at:   new Date().toISOString(),
        });

      // UNIQUE 제약 위반 = 이미 저장된 공지 → 중복 푸시 방지
      if (insertErr?.code === '23505') {
        console.log('[webhook] 중복 공지 — 푸시 생략:', noticeUrl);
        continue;
      }
      if (insertErr) {
        console.error('[webhook] DB insert 실패:', insertErr.message);
        continue;
      }

      // ⑦ push_tokens 조회 후 Expo Push API 호출
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('expo_token')
        .eq('user_id', sub.user_id);

      if (!tokens?.length) continue;

      await sendExpoPush(tokens.map(t => t.expo_token), subject, bodyHtml, noticeUrl);
    }

    return new Response('ok', { status: 200 });

  } catch (e) {
    console.error('[webhook] 예외:', e);
    return new Response('error', { status: 500 });
  }
});

/** refresh_token으로 새 access_token 발급, 실패 시 DB 갱신 */
async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string | null> {
  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     Deno.env.get('MS_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        scope:         'Mail.Read offline_access',
      }),
    }
  );

  if (!res.ok) {
    console.error('[webhook] access_token 갱신 실패 — 사용자 재인증 필요:', userId);
    return null;
  }

  const tokens = await res.json();

  // 새 refresh_token이 발급된 경우 DB 업데이트
  if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
    await supabase
      .from('mail_subscriptions')
      .update({ ms_refresh_token: tokens.refresh_token })
      .eq('user_id', userId);
  }

  return tokens.access_token;
}

/** 본문 HTML에서 manaba 공지 URL 추출 */
function extractManabaUrl(html: string): string | null {
  const match = html.match(/https?:\/\/[a-zA-Z0-9.-]*manaba\.jp[^\s"'<>]*/);
  return match ? match[0] : null;
}

/** Expo Push API로 푸시 알림 발송 */
async function sendExpoPush(tokens: string[], subject: string, bodyHtml: string, noticeUrl: string | null) {
  const messages = tokens.map(to => ({
    to,
    title: '📢 manaba 新着通知',
    body:  subject,
    data:  { subject, bodyHtml, noticeUrl },
    sound: 'default',
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error('[webhook] Expo Push 실패:', await res.text());
  }
}
