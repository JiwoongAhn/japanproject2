import { createClient } from 'jsr:@supabase/supabase-js@2';

// TODO: Azure 앱 등록(3-1) 완료 후 Supabase 환경변수에 추가
// supabase secrets set MS_CLIENT_ID=xxx MS_CLIENT_SECRET=xxx
const MS_CLIENT_ID     = Deno.env.get('MS_CLIENT_ID') ?? '';
const MS_CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET') ?? '';
const MS_TENANT_ID     = 'common';

// webhook URL: 우리 ms-graph-webhook Edge Function 엔드포인트
const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ms-graph-webhook`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirectUri, codeVerifier } = await req.json();

    if (!code || !redirectUri) {
      return json({ error: 'code와 redirectUri가 필요합니다' }, 400);
    }

    // ① auth code → access_token + refresh_token 교환
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     MS_CLIENT_ID,
          grant_type:    'authorization_code',
          code,
          redirect_uri:  redirectUri,
          code_verifier: codeVerifier ?? '',
        }),
      }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[ms-oauth-exchange] 토큰 교환 실패 status:', tokenRes.status, 'body:', err);
      // 200으로 반환해서 앱이 실제 에러 메시지를 받을 수 있게 함 (디버깅용)
      return json({ success: false, msError: err, msStatus: tokenRes.status });
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token } = tokens;

    // ② 사용자 이메일 확인 (Graph /me)
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const me = meRes.ok ? await meRes.json() : {};
    console.log('[ms-oauth-exchange] /me 응답:', JSON.stringify(me));
    // 개인 MSA는 mail이 null인 경우 있으므로 여러 필드 시도
    const msEmail = me.mail ?? me.userPrincipalName ?? me.displayName ?? 'unknown@microsoft.com';

    // ③ Microsoft Graph subscription 생성 (메일함 수신 감지)
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3일 후
    const subRes = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType:           'created',
        notificationUrl:      WEBHOOK_URL,
        resource:             "me/mailFolders('Inbox')/messages",
        expirationDateTime:   expiresAt,
        clientState:          Deno.env.get('WEBHOOK_CLIENT_STATE') ?? 'unipas-secret',
      }),
    });

    if (!subRes.ok) {
      const err = await subRes.text();
      console.error('[ms-oauth-exchange] subscription 생성 실패:', err);
      return json({ error: 'Graph subscription 생성 실패' }, 502);
    }

    const subscription = await subRes.json();

    // ④ Supabase에 저장 (service_role로만 접근 가능한 mail_subscriptions)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // JWT에서 user_id 추출
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) {
      console.error('[ms-oauth-exchange] 인증 오류:', userErr?.message);
      return json({ error: '인증 오류' }, 401);
    }

    const { error: dbErr } = await supabase
      .from('mail_subscriptions')
      .upsert({
        user_id:                  user.id,
        ms_account_email:         msEmail,
        ms_refresh_token:         refresh_token,  // TODO: 암호화 추가 (pgcrypto)
        subscription_id:          subscription.id,
        subscription_expires_at:  expiresAt,
      }, { onConflict: 'user_id' });

    if (dbErr) {
      console.error('[ms-oauth-exchange] DB 저장 실패:', dbErr.message, dbErr.code);
      return json({ error: 'DB 저장 실패', detail: dbErr.message }, 500);
    }

    return json({ success: true, subscriptionId: subscription.id });

  } catch (e) {
    console.error('[ms-oauth-exchange] 예외:', e);
    return json({ error: '서버 오류' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
