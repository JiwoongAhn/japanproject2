import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';

// 시간표 화면 내용 → 수업 목록 (AI 범용 시간표 파서)
//
// 입력 3종 (하나 이상):
//   page   : 앱 안 브라우저의 「時間割を読み取る」 버튼이 가져온 페이지 내용(앱에서 정리한 HTML) ← 메인
//   text   : 학생이 복사·붙여넣기한 텍스트
//   images : 사진첩에서 고른 스크린샷 (최대 3장) — 페이지가 이미지·PDF 라 글자를 못 가져오는 학교용 예비
//
// 학교마다 전용 파서를 짜는 대신, 학생이 보여주는 화면을 Claude 가 읽어 구조화한다.
// 이 함수는 "읽기"만 한다. 결과를 앱 형식({ parsed, unparsed })으로 바꾸는 건
// 앱의 순수 함수 normalizeAiCourses (src/utils/aiTimetable.js) 담당 — Jest 로 검증하기 위해.
//
// 보안·개인정보:
//   - 로그인 사용자만 (JWT 필수, verify_jwt 기본 true)
//   - 사용자당 24시간 DAILY_LIMIT 회 (ai_usage 테이블, service role 로만 접근)
//   - 이미지·텍스트는 저장하지 않고 로그에도 본문을 남기지 않는다
//   - API 키는 서버 시크릿(ANTHROPIC_API_KEY)에만 둔다

// 사용자 결정(2026-10-19): 가장 저렴한 기본 모델. 페이지 글자를 그대로 받아 읽으므로 충분하다고 판단.
// 국사관 정답 대조에서 정확도가 모자라면 상위 모델로 올린다. (Haiku 는 server-side fallback 미지원)
const MODEL = 'claude-haiku-5-5';
const DAILY_LIMIT = 10;
const MAX_IMAGES = 3;
const MAX_IMAGE_BASE64_CHARS = 2_000_000; // 약 1.5MB (앱에서 축소·압축해서 보낸다)
const MAX_TEXT_CHARS = 20_000;
const MAX_PAGE_CHARS = 120_000; // 정리된 HTML. PC 화면 시간표 표 1개는 보통 이보다 훨씬 작다
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

// 구조화 출력 스키마. null 대신 'unknown' / 0 / '' 으로 "모름"을 표현한다
// (앱 쪽 정규화가 모름 → 미리보기에서 사용자가 직접 고르게 처리)
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    courses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '科目名（学期の接頭辞・年度・クラス記号は除く）' },
          professor: { type: 'string', description: '教員名（不明なら空文字）' },
          room: { type: 'string', description: '教室（不明なら空文字）' },
          day: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'unknown'] },
          period: { type: 'integer', description: '時限 1〜10。不明なら 0' },
          term: { type: 'string', enum: ['spring', 'fall', 'unknown'] },
        },
        required: ['name', 'professor', 'room', 'day', 'period', 'term'],
        additionalProperties: false,
      },
    },
  },
  required: ['courses'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  'あなたは日本の大学の時間割を読み取るアシスタントです。',
  '入力は学生の大学ポータルの時間割ページ（HTML）、コピーしたテキスト、またはスクリーンショットです。大学ごとに画面の形式は違います。',
  '',
  '登録されている授業を1コマずつ courses に入れてください。',
  '- 同じ授業が週2回あるときは、曜日・時限ごとに別の要素にする。',
  '- 2時限連続の授業は、時限ごとに別の要素にする。',
  '- name は科目名だけ。「26後期」「2026」「_後_」などの年度・学期の接頭辞は外し、学期は term に入れる。',
  '- professor は教員名だけ。名前の後ろに付いたアカウントID（例: 「小久保 雄介kokuboys」の kokuboys）は外す。',
  '- 前期・春学期・春期 → spring、後期・秋学期・秋期 → fall。通年や判断できないときは unknown。ページ上部の「2026年度 後期」のような見出しも学期の手がかりにする。',
  '- 科目名の後ろの「(_通年)」のような学期表示は name から外す。科目コード（例: E046551）・単位数・「複数学期」などのバッジは無視する。',
  '- room は教室名だけ。末尾の「教室」という語は外す（「18C41 教室」→「18C41」、「PC4 教室（25号館4F）」→「PC4（25号館4F）」）。',
  '- 日表示・今日の予定のような一日分の画面ではなく、週の時間割表があればそちらを優先する。',
  '- 1つの表に「春期」「秋期」の行が交互に並ぶ形式では、各授業がどちらの行にあるかで term を決める。',
  '- キャンパス名（例: 町田、世田谷）だけの表記は room に入れない。単位数（例: [2]）や「シラバス」リンクは無視する。',
  '- 画面に書かれていない情報は決して推測しない。曜日・時限が書かれていなければ day=unknown, period=0。',
  '- 時間割以外の要素（お知らせ、課題、メニュー、空きコマ）は含めない。',
  '- 時間割が見つからなければ courses は空配列。',
].join('\n');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ① 호출자 확인 — 로그인 사용자만
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'ログインが必要です' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: '認証に失敗しました' }, 401);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[parse-timetable] ANTHROPIC_API_KEY 미설정');
      return json({ error: 'この機能はまだ準備中です' }, 503);
    }

    // ② 입력 검증 — 이미지(최대 3장) 또는 텍스트 중 하나 이상
    const body = await req.json().catch(() => ({}));
    const images: { mediaType: string; data: string }[] = Array.isArray(body?.images) ? body.images : [];
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const page = typeof body?.page === 'string' ? body.page.trim() : '';
    const universityName = typeof body?.universityName === 'string' ? body.universityName.slice(0, 50) : '';
    const periodHint = typeof body?.periodHint === 'string' ? body.periodHint.slice(0, 500) : '';

    if (images.length === 0 && !text && !page) return json({ error: '時間割の内容がありません' }, 400);
    if (images.length > MAX_IMAGES) return json({ error: `画像は${MAX_IMAGES}枚までです` }, 400);
    for (const img of images) {
      if (!ALLOWED_MEDIA.has(img?.mediaType) || typeof img?.data !== 'string' || !img.data) {
        return json({ error: '画像の形式が正しくありません' }, 400);
      }
      if (img.data.length > MAX_IMAGE_BASE64_CHARS) return json({ error: '画像が大きすぎます' }, 413);
    }
    if (text.length > MAX_TEXT_CHARS) return json({ error: 'テキストが長すぎます' }, 413);
    if (page.length > MAX_PAGE_CHARS) return json({ error: 'ページが大きすぎます。時間割だけが表示された画面でお試しください' }, 413);

    // ③ 하루 횟수 제한 (실패한 호출도 1회로 센다 — 남용 방지가 목적)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('kind', 'timetable')
      .gte('created_at', since);
    if (countErr) {
      console.error('[parse-timetable] 사용량 조회 실패:', countErr.message);
      return json({ error: 'サーバーエラーが発生しました' }, 500);
    }
    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ error: '今日はこれ以上読み取れません。明日もう一度お試しください' }, 429);
    }
    await admin.from('ai_usage').insert({ user_id: user.id, kind: 'timetable' });

    // ④ Claude 호출
    const context = [
      universityName && `大学: ${universityName}`,
      periodHint && `この大学の時限と時刻: ${periodHint}`,
    ].filter(Boolean).join('\n');

    const content: Anthropic.ContentBlockParam[] = images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType as 'image/jpeg', data: img.data },
    }));
    content.push({
      type: 'text',
      text: [
        context,
        page && `時間割ページのHTML:\n${page}`,
        text && `時間割のテキスト:\n${text}`,
        images.length > 0 && 'この画像の時間割を読み取ってください。',
      ].filter(Boolean).join('\n\n'),
    });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      messages: [{ role: 'user', content }],
    } as any);

    if (response.stop_reason === 'refusal') {
      console.error('[parse-timetable] refusal:', (response as any).stop_details?.category);
      return json({ error: '読み取れませんでした。別の画像でお試しください' }, 422);
    }
    if (response.stop_reason === 'max_tokens') {
      return json({ error: '授業が多すぎて読み取れませんでした。画像を分けてお試しください' }, 422);
    }

    const out = response.content
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('');
    let parsed: { courses?: unknown[] };
    try {
      parsed = JSON.parse(out);
    } catch {
      console.error('[parse-timetable] JSON 파싱 실패');
      return json({ error: '読み取りに失敗しました' }, 502);
    }

    // usage 는 비용 실측용(토큰 수만, 본문 없음)
    return json({
      courses: Array.isArray(parsed?.courses) ? parsed.courses : [],
      usage: { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: '混み合っています。しばらくしてからお試しください' }, 503);
    }
    if (e instanceof Anthropic.APIError) {
      console.error('[parse-timetable] Anthropic 오류:', e.status);
      return json({ error: '読み取りに失敗しました' }, 502);
    }
    console.error('[parse-timetable] 예외:', (e as Error)?.message);
    return json({ error: 'サーバーエラーが発生しました' }, 500);
  }
});
