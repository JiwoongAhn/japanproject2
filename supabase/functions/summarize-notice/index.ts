import { createClient } from 'jsr:@supabase/supabase-js@2';
import { summarizeNotice, stripHtml } from '../_shared/noticeSummary.ts';

// 통지(마나바 공지·메일 본문)를 Claude로 3~4줄 일본어 요약하는 온디맨드 함수.
// 앱에서 로그인 사용자가 '📄 AIで要約' 버튼을 누를 때만 호출 → 비용은 누른 만큼만 발생.
// API 키(ANTHROPIC_API_KEY)는 앱에 두면 유출 위험이라 서버(Edge Function) 시크릿에만 둔다.
// verify_jwt: 기본값 true (앱 사용자 JWT로 호출) — mail-provision과 동일 패턴.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // ① 호출자(앱 사용자) 식별 — API 키 남용 방지 (로그인 사용자만 허용)
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'ログインが必要です' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: '認証に失敗しました' }, 401);

    // ② 입력 — noticeId 가 있으면 이미 만든 요약(통지에 AI 요약 ON 사용자)을 재사용해 비용 0
    const { subject, bodyHtml, noticeId } = await req.json().catch(() => ({}));
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    if (noticeId) {
      const { data: row } = await admin
        .from('manaba_notices')
        .select('ai_summary')
        .eq('id', noticeId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (row?.ai_summary) return json({ summary: row.ai_summary });
    }
    if (!stripHtml(bodyHtml ?? '')) return json({ error: '要約できる本文がありません' }, 400);

    // ③ Claude 호출 — 학생이 빠르게 파악할 수 있게 일본어 3~4줄 요점 정리 (_shared/noticeSummary)
    const summary = await summarizeNotice({ subject, bodyHtml });
    if (!summary) return json({ error: '要約の生成に失敗しました' }, 502);

    // 본인 통지면 저장 → 다음에 열면 다시 부르지 않음
    if (noticeId) {
      await admin.from('manaba_notices').update({ ai_summary: summary })
        .eq('id', noticeId).eq('user_id', user.id);
    }

    return json({ summary });
  } catch (e) {
    console.error('[summarize-notice] 예외:', e);
    return json({ error: 'サーバーエラーが発生しました' }, 500);
  }
});
