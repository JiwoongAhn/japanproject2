import { createClient } from 'jsr:@supabase/supabase-js@2';

// 통지(마나바 공지·메일 본문)를 Claude로 3~4줄 일본어 요약하는 온디맨드 함수.
// 앱에서 로그인 사용자가 '📄 AIで要約' 버튼을 누를 때만 호출 → 비용은 누른 만큼만 발생.
// API 키(ANTHROPIC_API_KEY)는 앱에 두면 유출 위험이라 서버(Edge Function) 시크릿에만 둔다.
// verify_jwt: 기본값 true (앱 사용자 JWT로 호출) — mail-provision과 동일 패턴.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
// 요약은 가벼운 작업이라 가장 저렴하고 빠른 Haiku 사용 (품질 충분)
const MODEL = 'claude-haiku-4-5-20251001';
// 입력 폭주/비용 방지: 본문이 아무리 길어도 앞부분만 요약에 사용
const MAX_INPUT_CHARS = 6000;

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

// 메일/공지 HTML → 순수 텍스트 (Claude 입력용, manabaMailSummary와 동일한 거친 방식)
function stripHtml(html: string): string {
  if (!html) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

    // ② API 키 확인 — 미설정이면 앱이 안내문을 띄우도록 명확한 에러 반환
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[summarize-notice] ANTHROPIC_API_KEY 미설정');
      return json({ error: '要約機能はまだ準備中です' }, 503);
    }

    // ③ 입력 파싱 + 정리
    const { subject, bodyHtml } = await req.json().catch(() => ({}));
    const text = stripHtml(bodyHtml ?? '').slice(0, MAX_INPUT_CHARS);
    if (!text) return json({ error: '要約できる本文がありません' }, 400);

    // ④ Claude 호출 — 학생이 빠르게 파악할 수 있게 일본어 3~4줄 요점 정리
    const systemPrompt =
      'あなたは大学のLMS（manaba）のお知らせを、学生が一目で把握できるように要約するアシスタントです。' +
      '出力は日本語のみ。箇条書きで3〜4項目、各行は簡潔に。' +
      '締切・提出物・場所・持ち物など「学生が取るべき行動」を優先して抽出する。' +
      '本文に無い情報は決して創作しない。挨拶文や署名・定型フッターは省く。前置きや結びの文章は書かず、箇条書きだけを返す。';

    const userPrompt =
      `件名: ${subject ?? '(なし)'}\n\n本文:\n${text}`;

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[summarize-notice] Anthropic 오류:', resp.status, errText.slice(0, 300));
      return json({ error: '要約の生成に失敗しました' }, 502);
    }

    const data = await resp.json();
    // Anthropic Messages API: content 배열의 text 블록들을 이어붙임
    const summary = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n').trim()
      : '';

    if (!summary) return json({ error: '要約の生成に失敗しました' }, 502);

    return json({ summary });
  } catch (e) {
    console.error('[summarize-notice] 예외:', e);
    return json({ error: 'サーバーエラーが発生しました' }, 500);
  }
});
