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
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'メールアドレスが正しくありません' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6자리 랜덤 숫자 코드 생성
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10분 후

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 기존 미사용 OTP 삭제
    await supabase
      .from('email_otps')
      .delete()
      .eq('email', email)
      .eq('used', false);

    // 새 OTP 저장
    const { error: insertError } = await supabase
      .from('email_otps')
      .insert({ email, code, expires_at: expiresAt });

    if (insertError) {
      throw new Error('OTP保存に失敗しました');
    }

    // Resend로 이메일 발송
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEYが設定されていません');
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Unipas <onboarding@resend.dev>',
        to: [email],
        subject: '【Unipas】認証コード',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #3182F6; margin-bottom: 8px;">ユニパス</h2>
            <p style="color: #333; font-size: 16px; margin-bottom: 24px;">以下の認証コードを10分以内にアプリへ入力してください。</p>
            <div style="background: #F2F4F6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 40px; font-weight: 800; letter-spacing: 8px; color: #3182F6;">${code}</span>
            </div>
            <p style="color: #888; font-size: 13px;">このコードは10分間有効です。心当たりがない場合は無視してください。</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      throw new Error(`メール送信失敗: ${errBody}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
