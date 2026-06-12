import { createClient } from 'jsr:@supabase/supabase-js@2';

// 메일전달 방식 푸시용 "학생 전용 전달주소" 발급 함수.
// 앱에서 로그인 사용자가 호출 → forward_token을 1개 발급(이미 있으면 그대로 반환, 멱등).
// 반환된 {token}@unipas.app 으로 학생이 학교 Outlook 전달 규칙을 건다.
// verify_jwt: true (앱 사용자 JWT로 호출) — config.toml에서 명시.

const FORWARD_DOMAIN = Deno.env.get('FORWARD_DOMAIN') ?? 'unipas.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** 추측 불가능한 16바이트(32 hex) 랜덤 토큰 생성 */
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: '로그인이 필요합니다' }, 401);

    // ① 호출자(앱 사용자) 식별 — anon 클라이언트 + 사용자 JWT로 getUser
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: '인증 실패' }, 401);

    // ② 실제 쓰기는 service_role 클라이언트로 (RLS 우회, forward_token 생성 통제)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ③ 이미 발급된 토큰이 있으면 그대로 반환 (멱등)
    const { data: existing } = await admin
      .from('mail_subscriptions')
      .select('forward_token, verified_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.forward_token) {
      return json({
        address: `${existing.forward_token}@${FORWARD_DOMAIN}`,
        token: existing.forward_token,
        verified: !!existing.verified_at,
      });
    }

    // ④ 신규 발급 — UNIQUE(user_id) 경쟁 조건 대비 upsert(onConflict user_id)
    const token = generateToken();
    const { data: inserted, error: insErr } = await admin
      .from('mail_subscriptions')
      .upsert(
        { user_id: user.id, forward_token: token },
        { onConflict: 'user_id', ignoreDuplicates: false },
      )
      .select('forward_token')
      .single();

    if (insErr || !inserted) {
      console.error('[mail-provision] upsert 실패:', insErr?.message);
      return json({ error: '전달주소 발급에 실패했습니다' }, 500);
    }

    return json({
      address: `${inserted.forward_token}@${FORWARD_DOMAIN}`,
      token: inserted.forward_token,
      verified: false,
    });
  } catch (e) {
    console.error('[mail-provision] 예외:', e);
    return json({ error: '서버 오류' }, 500);
  }
});
