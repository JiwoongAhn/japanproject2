import { createClient } from 'jsr:@supabase/supabase-js@2';

// 개발용 — 특정 user_id에게 테스트 푸시 1건 발송
// 사용법: supabase functions invoke send-test-push --body '{"userId":"xxx"}'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return json({ error: 'userId가 필요합니다' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', userId);

    if (error || !tokens?.length) {
      return json({ error: '푸시 토큰 없음' }, 404);
    }

    const messages = tokens.map(t => ({
      to:    t.expo_token,
      title: '📢 [테스트] manaba 新着通知',
      body:  '情報処理演習 授業資料を更新しました',
      data:  {
        subject:   '[테스트] 情報処理演習 授業資料更新',
        bodyHtml:  '<p>テスト本文です。manaba からの通知をシミュレートしています。</p>',
        noticeUrl: 'https://kokushikan.manaba.jp/ct/course_notice',
      },
      sound: 'default',
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(messages),
    });

    const result = await res.json();
    console.log('[send-test-push] 결과:', JSON.stringify(result));

    return json({ success: true, sent: tokens.length, result });

  } catch (e) {
    console.error('[send-test-push] 예외:', e);
    return json({ error: '서버 오류' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
