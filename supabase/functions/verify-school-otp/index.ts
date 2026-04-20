import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'invalid_input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 유효한 OTP 조회 (미사용 + 미만료)
    const { data, error } = await supabase
      .from('email_otps')
      .select('id, expires_at')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      // 만료됐는지 / 코드가 틀린지 구분
      const { data: anyOtp } = await supabase
        .from('email_otps')
        .select('expires_at')
        .eq('email', email)
        .eq('code', code)
        .eq('used', false)
        .maybeSingle();

      const reason = anyOtp ? 'expired' : 'wrong';
      return new Response(
        JSON.stringify({ valid: false, reason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OTP 사용 처리
    await supabase
      .from('email_otps')
      .update({ used: true })
      .eq('id', data.id);

    return new Response(
      JSON.stringify({ valid: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ valid: false, reason: 'server_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
