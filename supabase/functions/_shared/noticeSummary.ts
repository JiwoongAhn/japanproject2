// manaba 통지 AI 요약 — summarize-notice(버튼) / mail-inbound(통지에 요약 표시) / send-test-push 공용
// API 키(ANTHROPIC_API_KEY)는 Edge Function 시크릿에만 둔다.
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';

// 시간표 읽기(parse-timetable)와 같은 가장 기본 모델
export const SUMMARY_MODEL = 'claude-haiku-5-5';
// 입력 폭주/비용 방지: 본문이 아무리 길어도 앞부분만 요약에 사용
const MAX_INPUT_CHARS = 6000;

const SYSTEM_PROMPT =
  'あなたは大学のLMS（manaba）のお知らせを、学生が一目で把握できるように要約するアシスタントです。' +
  '出力は日本語のみ。「・」で始まる箇条書きを3〜4行、各行は40字以内。' +
  '締切・提出物・場所・持ち物など「学生が取るべき行動」を優先して抽出する。' +
  '本文に無い情報は決して創作しない。挨拶文や署名・定型フッターは省く。前置きや結びの文章は書かず、箇条書きだけを返す。';

// 메일/공지 HTML → 순수 텍스트 (Claude 입력용, manabaMailSummary와 동일한 거친 방식)
export function stripHtml(html: string): string {
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

// 요약 생성. 본문이 없거나 실패하면 null (호출부는 요약 없이 진행)
//   timeoutMs: 통지 발송 경로에서는 짧게 — 요약 때문에 통지가 늦어지거나 끊기면 안 된다
export async function summarizeNotice(
  { subject, bodyHtml, timeoutMs = 20000 }: { subject?: string; bodyHtml?: string; timeoutMs?: number },
): Promise<string | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('[noticeSummary] ANTHROPIC_API_KEY 미설정');
    return null;
  }
  const text = stripHtml(bodyHtml ?? '').slice(0, MAX_INPUT_CHARS);
  if (!text) return null;

  try {
    const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 });
    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `件名: ${subject || '(なし)'}\n\n本文:\n${text}` }],
    } as any);
    if (response.stop_reason === 'refusal') return null;
    const summary = response.content
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    return summary || null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error('[noticeSummary] Anthropic 오류:', e.status);
    else console.error('[noticeSummary] 예외:', (e as Error)?.name);
    return null;
  }
}
