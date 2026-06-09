import { createClient } from 'jsr:@supabase/supabase-js@2';

// Microsoft Graph subscription 최대 만료: 3일
// 이 함수는 매일 1회 pg_cron으로 실행 — 만료 24시간 이내 subscription을 갱신
const RENEW_BEFORE_HOURS = 24;
const NEW_EXPIRY_DAYS    = 3;
const MS_TENANT_ID       = 'common';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 만료까지 24시간 이내인 subscription 전체 조회
  const threshold = new Date(Date.now() + RENEW_BEFORE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: subs, error } = await supabase
    .from('mail_subscriptions')
    .select('user_id, subscription_id, ms_refresh_token')
    .lte('subscription_expires_at', threshold)
    .not('subscription_id', 'is', null);

  if (error) {
    console.error('[ms-graph-renew] 조회 실패:', error.message);
    return new Response('error', { status: 500 });
  }

  console.log(`[ms-graph-renew] 갱신 대상: ${subs?.length ?? 0}건`);
  let renewed = 0;

  for (const sub of subs ?? []) {
    // ① refresh_token으로 새 access_token 발급
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     Deno.env.get('MS_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
          grant_type:    'refresh_token',
          refresh_token: sub.ms_refresh_token ?? '',
          scope:         'Mail.Read offline_access',
        }),
      }
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[ms-graph-renew] 토큰 갱신 실패 user=${sub.user_id}:`, errBody);
      // invalid_grant = refresh_token이 만료/무효화됨 → 사용자가 직접 재연결해야 함
      // (5xx 같은 일시 오류는 다음 실행에서 자동 재시도되므로 배지 띄우지 않음)
      if (errBody.includes('invalid_grant')) {
        await supabase
          .from('mail_subscriptions')
          .update({ needs_reauth: true })
          .eq('user_id', sub.user_id);
        console.log(`[ms-graph-renew] 재연결 필요 표시 user=${sub.user_id}`);
      }
      continue;
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;

    // ② Graph subscription 만료일 연장
    const newExpiry = new Date(Date.now() + NEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const patchRes  = await fetch(
      `https://graph.microsoft.com/v1.0/subscriptions/${sub.subscription_id}`,
      {
        method:  'PATCH',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expirationDateTime: newExpiry }),
      }
    );

    if (!patchRes.ok) {
      console.error(`[ms-graph-renew] subscription 갱신 실패 id=${sub.subscription_id}:`, await patchRes.text());
      continue;
    }

    // ③ DB 업데이트
    await supabase
      .from('mail_subscriptions')
      .update({
        subscription_expires_at: newExpiry,
        ms_refresh_token:        tokens.refresh_token ?? sub.ms_refresh_token,
      })
      .eq('user_id', sub.user_id);

    renewed++;
    console.log(`[ms-graph-renew] 갱신 완료 user=${sub.user_id}`);
  }

  return new Response(
    JSON.stringify({ renewed, total: subs?.length ?? 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
