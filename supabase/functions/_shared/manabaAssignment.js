// manaba 課題 메일 → 課題 행 정보 (mail-inbound 가 자동 추가에 사용)
//
// AI 가 아니라 규칙으로 읽는다. manaba 課題 메일은 양식이 고정이라
//   제목  "manaba - {과목} - レポート公開のお知らせ"
//   본문  [コース名]：… / [課題名]：… / [受付終了日時]：2026-10-08 16:15:00
// 칸을 그대로 꺼내면 100% 정확하다 (2026-10-21 실메일 22건 확인). AI 를 쓰면 마감일 오독 위험만 생긴다.
//
// 앱(Jest)과 서버(Deno) 둘 다 읽어야 해서 TS 가 아니라 순수 JS 로 둔다.
// 테스트: __tests__/utils/manabaAssignment.test.js

// 제목 끝 "…のお知らせ" 로 종류 판정 (2026-10-26 운영 DB 실메일 전수 대조).
//   成績公開 / アンケート未提出(독촉) / コースニュース / スレッド 는 대상 아님.
//   アンケート公開 은 수업 リアクションペーパー 도 이 양식으로 오므라 읽되,
//   「시간표에 있는 과목」일 때만 넣는다(syncAssignmentFromMail) — 全国学生調査 같은 전교 조사 제외.
//   提出 메일은 manaba 리마인더 설정 「課題提出のお知らせ」 가 「受信する」 일 때만 온다(본인 제출 / 교원 대리 제출).
const SUBJECT_RULES = [
  { re: /提出取消/, action: 'unsubmit' },                 // レポート提出取消(再提出)のお知らせ
  { re: /(レポート|小テスト|アンケート|課題)提出(完了)?のお知らせ/, action: 'submit' },
  { re: /(レポート|小テスト|アンケート)公開のお知らせ/, action: 'publish' },
];
// 제목 양식이 바뀌어도 본문 문장으로 한 번 더 잡는다 (実メール: 「…に課題が提出されました。」「…が未提出状態に戻りました。」)
const BODY_RULES = [
  { re: /未提出状態に戻りました/, action: 'unsubmit' },
  { re: /課題が提出されました/, action: 'submit' },
];

export function classifyAssignmentMail(subject, text = '') {
  const s = String(subject ?? '');
  if (/成績公開|未提出のお知らせ/.test(s)) return null;
  const rule = SUBJECT_RULES.find((r) => r.re.test(s)) ?? BODY_RULES.find((r) => r.re.test(String(text ?? '')));
  return rule ? rule.action : null;
}

// 課題 종류 — アンケート 는 과목 연결이 될 때만 넣기 위해 구분한다
//   課題名에 「小テスト」 가 들어간 レポート 도 있어(実メール 「10月22日小テスト」) 제목·「--X情報--」 머리글만 본다
const KIND_BY_WORD = { レポート: 'report', 小テスト: 'quiz', アンケート: 'survey' };
function detectKind(subject, text) {
  const m = String(subject ?? '').match(/(レポート|小テスト|アンケート)(公開|提出)/)
    ?? String(text ?? '').match(/-{2,}(レポート|小テスト|アンケート)情報/);
  return m ? KIND_BY_WORD[m[1]] : 'report';
}

function stripHtml(html) {
  return String(html ?? '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n?/g, '\n');
}

function extractField(text, label) {
  const m = text.match(new RegExp(`\\[${label}\\]\\s*[：:]\\s*([^\\n]+)`));
  return m ? m[1].trim() : null;
}

// 과목명 비교용 — 전각/반각·로마숫자(Ⅱ→II)·공백 차이를 없앤다
export function normalizeCourseName(name) {
  return String(name ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

// "2026-10-08 16:15:00"(JST) → { dueAt: ISO, dueDate: 'YYYY-MM-DD' }
// 마감이 0:00 이면 실제로는 "전날까지" 라서 dueDate 는 전날로 둔다 (D-day 하루 어긋남 방지)
export function parseDeadline(raw) {
  const m = String(raw ?? '').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return { dueAt: null, dueDate: null };
  const [, y, mo, d, h, mi, s = '00'] = m;
  const dueAt = `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
  const lastMoment = new Date(new Date(dueAt).getTime() - 1000); // 마감 1초 전이 속한 날
  const jst = new Date(lastMoment.getTime() + 9 * 3600 * 1000);
  return { dueAt, dueDate: jst.toISOString().slice(0, 10) };
}

// 課題 메일이 아니면 null
// 반환: { action: 'publish'|'submit'|'unsubmit', kind: 'report'|'quiz'|'survey', courseLabel, title, dueAt, dueDate, sourceKey }
export function parseManabaAssignmentMail({ subject, bodyHtml } = {}) {
  const text = stripHtml(bodyHtml);
  const action = classifyAssignmentMail(subject, text);
  if (!action) return null;

  const title = extractField(text, '課題名');
  if (!title) return null;

  // 과목명은 본문 우선 (제목은 길면 "…" 로 잘린다)
  let courseLabel = extractField(text, 'コース名');
  if (!courseLabel) {
    const m = String(subject ?? '').match(/manaba\s*[-‐−–]\s*(.+?)\s*[-‐−–]/);
    courseLabel = m ? m[1].trim() : null;
  }

  const { dueAt, dueDate } = parseDeadline(extractField(text, '受付終了日時'));
  // 같은 課題 판별 열쇠 — 공개 메일과 제출 메일을 이어 준다
  const sourceKey = `${normalizeCourseName(courseLabel)}|${normalizeCourseName(title)}`;

  return { action, kind: detectKind(subject, text), courseLabel, title, dueAt, dueDate, sourceKey };
}

// 메일의 과목명 → 사용자 시간표 courses.id (정확히 같을 때만; 비슷한 과목에 잘못 붙이는 것보다 비워두는 게 낫다)
export function matchCourseId(courseLabel, courses) {
  const key = normalizeCourseName(courseLabel);
  if (!key) return null;
  const hit = (courses ?? []).find((c) => normalizeCourseName(c.name) === key);
  return hit ? hit.id : null;
}

// 푸시 본문에 붙일 한 줄 — "📝 課題に追加しました（締切 10/08 16:15）"
export function assignmentPushNote(parsed) {
  if (!parsed) return null;
  if (parsed.action === 'submit') return '✅ 課題を「提出済」にしました';
  if (parsed.action !== 'publish') return null;
  const m = parsed.dueAt?.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '📝 課題に追加しました';
  // 0:00 마감은 앱 목록과 같게 "전날 24:00" (formatDueLabel)
  if (m[3] === '00' && m[4] === '00' && parsed.dueDate) {
    return `📝 課題に追加しました（締切 ${parsed.dueDate.slice(5, 7)}/${parsed.dueDate.slice(8, 10)} 24:00）`;
  }
  return `📝 課題に追加しました（締切 ${m[1]}/${m[2]} ${m[3]}:${m[4]}）`;
}

/**
 * manaba 課題 메일 → assignments 반영 (mail-inbound 가 통지 저장 직후 호출).
 * 푸시에 붙일 한 줄을 돌려준다 — 해당 없음·실패면 null. 절대 throw 하지 않는다(통지 푸시를 막지 않게).
 *   publish  : 없으면 추가, 이미 있으면(재공개) 마감만 갱신 — 사용자가 바꾼 상태(提出済)는 건드리지 않음
 *   submit   : 같은 課題(source_key)를 提出済 로
 *   unsubmit : 提出取消 → 未提出 으로 되돌림
 * supabase = service_role 클라이언트. 테스트: __tests__/utils/manabaAssignment.test.js (가짜 DB)
 */
export async function syncAssignmentFromMail(supabase, userId, noticeId, subject, html) {
  try {
    const parsed = parseManabaAssignmentMail({ subject, bodyHtml: html });
    if (!parsed) return null;

    if (parsed.action === 'publish') {
      if (!parsed.dueDate) return null; // 마감 없는 공개 메일은 넣지 않는다 (due_date 필수 + 정렬 불가)
      const { data: existing, error: findErr } = await supabase
        .from('assignments')
        .select('id')
        .eq('user_id', userId)
        .eq('source_key', parsed.sourceKey)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing) {
        const { error } = await supabase.from('assignments')
          // 마감이 바뀌었을 수 있으니 締切 알림 기록(前日 reminded_at·3日前 reminded_3d_at)도 비워 다시 알리게 한다
          .update({ due_at: parsed.dueAt, due_date: parsed.dueDate, source_notice_id: noticeId, reminded_at: null, reminded_3d_at: null })
          .eq('id', existing.id);
        if (error) throw error;
        return assignmentPushNote(parsed);
      }
      const { data: courses } = await supabase
        .from('courses').select('id, name').eq('user_id', userId);
      const courseId = matchCourseId(parsed.courseLabel, courses);
      // アンケート 는 내 시간표 과목일 때만 (수업 リアクションペーパー O / 全国学生調査·학부 공지 코스 X)
      if (parsed.kind === 'survey' && !courseId) return null;
      const { error } = await supabase.from('assignments').insert({
        user_id: userId,
        course_id: courseId,
        course_label: parsed.courseLabel,
        title: parsed.title,
        due_date: parsed.dueDate,
        due_at: parsed.dueAt,
        status: 'pending',
        source: 'manaba',
        source_key: parsed.sourceKey,
        source_notice_id: noticeId,
      });
      // 23505 = 동시에 같은 메일 2통 → 이미 들어갔으니 성공으로 본다
      if (error && error.code !== '23505') throw error;
      return assignmentPushNote(parsed);
    }

    // 提出 / 提出取消 — 앱이 넣어둔 課題가 있을 때만 상태를 바꾼다
    const { data: updated, error } = await supabase
      .from('assignments')
      .update({ status: parsed.action === 'submit' ? 'submitted' : 'pending' })
      .eq('user_id', userId)
      .eq('source_key', parsed.sourceKey)
      .select('id');
    if (error) throw error;
    return updated?.length ? assignmentPushNote(parsed) : null;
  } catch (e) {
    console.error('[manabaAssignment] 課題 처리 실패:', e?.message ?? e);
    return null;
  }
}
