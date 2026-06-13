import { createClient } from 'jsr:@supabase/supabase-js@2';

// Apple 심사용 데모 로그인.
// 학교 이메일 OTP 게이트를 리뷰어가 통과하도록, 고정 데모 이메일+코드가 맞으면
// 관리자 권한으로 magiclink 토큰을 발급해 반환한다. 클라이언트는 이 token_hash로
// verifyOtp 하여 정상 세션을 만든다. (데모 계정은 민감 데이터 없음)
//
// 필요한 Secret:
//   DEMO_EMAIL     (선택, 기본 appreview@kokushikan.ac.jp)
//   DEMO_OTP_CODE  (필수, 6자리 — 미설정 시 동작 안 함)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, code } = await req.json();
    const DEMO_EMAIL = Deno.env.get('DEMO_EMAIL') ?? 'appreview@kokushikan.ac.jp';
    const DEMO_CODE = Deno.env.get('DEMO_OTP_CODE');

    if (!DEMO_CODE) return json({ valid: false, reason: 'not_configured' }, 500);
    if (email !== DEMO_EMAIL || code !== DEMO_CODE) {
      return json({ valid: false, reason: 'invalid' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 데모 유저 보장 (이미 있으면 'already registered' 에러는 무시)
    await admin.auth.admin.createUser({ email: DEMO_EMAIL, email_confirm: true });

    // magiclink 토큰 발급 (메일 발송 아님 — 토큰만 생성)
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: DEMO_EMAIL,
    });

    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return json({ valid: false, reason: 'link_failed' }, 500);

    return json({ valid: true, token_hash: tokenHash });
  } catch (_e) {
    return json({ valid: false, reason: 'server_error' }, 500);
  }
});
