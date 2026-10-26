// 締切 3日前·前日 알림 — 매일 JST 18:00 (cron) 에 deadline-reminder 함수가 호출한다.
//
//   前日: 未提出(pending) + 아직 안 알림(reminded_at NULL) + 마감이 지금~30시간 안
//     → 18:00 실행이면 「오늘 밤」 과 「내일 하루」 마감이 걸린다 (= 전날 저녁 알림)
//   3日前: 未提出 + 아직 안 알림(reminded_3d_at NULL) + 마감일(JST)이 정확히 3일 뒤
//     → 이틀 전에 추가된 課題는 3日前 시점이 지났으므로 前日 알림만 간다 (몰아서 보내지 않는다)
//   한 사람에게 하루 최대 1통 — 여러 건(前日·3日前 섞여도)이면 한 통으로 묶는다
//   마감이 바뀌면(재공개) mail-inbound 가 reminded_at·reminded_3d_at 을 비워 다시 알린다
//   마이페이지 「締切前日に通知」 OFF(profiles.deadline_reminder=false) 면 보내지 않는다
//
// 앱(Jest)과 서버(Deno) 공용 순수 JS. 테스트: __tests__/utils/deadlineReminder.test.js

export const REMINDER_WINDOW_HOURS = 30;
export const EARLY_REMINDER_DAYS = 3;
const JST_MS = 9 * 3600 * 1000;
const MAX_LINES = 3;

// 'YYYY-MM-DD'(JST) of a Date
function jstDate(d) {
  return new Date(d.getTime() + JST_MS).toISOString().slice(0, 10);
}

// 실제 마감 시각 — 시각이 있으면(manaba 자동 추가) 그것, 없으면(수동 등록) 마감일 23:59:59 JST
export function deadlineOf(a) {
  if (a?.due_at) return new Date(a.due_at);
  if (!a?.due_date) return null;
  return new Date(`${a.due_date}T23:59:59+09:00`);
}

// 알릴 課題 고르기
export function pickDueSoon(assignments, now = new Date(), windowHours = REMINDER_WINDOW_HOURS) {
  const end = now.getTime() + windowHours * 3600 * 1000;
  return (assignments ?? [])
    .filter((a) => a && a.status === 'pending' && !a.reminded_at)
    .filter((a) => {
      const d = deadlineOf(a);
      return d && d.getTime() > now.getTime() && d.getTime() <= end;
    })
    .sort((x, y) => deadlineOf(x) - deadlineOf(y));
}

// 3日前 알림 대상 — 마감일(JST, 0:00 마감은 전날로 저장된 due_date)이 오늘부터 정확히 3일 뒤
export function pickDueInDays(assignments, now = new Date(), days = EARLY_REMINDER_DAYS) {
  const target = jstDate(new Date(now.getTime() + days * 24 * 3600 * 1000));
  return (assignments ?? [])
    .filter((a) => a && a.status === 'pending' && !a.reminded_3d_at && !a.reminded_at)
    .filter((a) => a.due_date === target && deadlineOf(a)?.getTime() > now.getTime())
    .sort((x, y) => deadlineOf(x) - deadlineOf(y));
}

// "今日 23:59" / "明日 16:25" / "明日まで"(수동, 시각 없음) / 0:00 마감은 전날 "24:00"
export function deadlineLabel(a, now = new Date()) {
  // 표시 날짜는 due_date (0:00 마감은 이미 전날로 저장돼 있다)
  const today = jstDate(now);
  const tomorrow = jstDate(new Date(now.getTime() + 24 * 3600 * 1000));
  const date = a.due_date;
  const day = date === today ? '今日' : date === tomorrow ? '明日' : `${date.slice(5, 7)}/${date.slice(8, 10)}`;
  if (!a.due_at) return `${day}まで`;
  const t = new Date(new Date(a.due_at).getTime() + JST_MS).toISOString().slice(11, 16);
  return `${day} ${t === '00:00' ? '24:00' : t}`;
}

function courseOf(a) {
  return a.courses?.name || a.course_label || '';
}

// 한 사람분 알림 문구 — items 는 pickDueSoon 결과(마감 순)
export function buildReminderMessage(items, now = new Date()) {
  if (!items?.length) return null;
  const lines = items.slice(0, MAX_LINES).map((a) => {
    const course = courseOf(a);
    return `${deadlineLabel(a, now)}｜${course ? `${course}「${a.title}」` : a.title}`;
  });
  if (items.length > MAX_LINES) lines.push(`ほか${items.length - MAX_LINES}件`);
  const first = deadlineLabel(items[0], now).split(' ')[0].replace('まで', '');
  const early = !['今日', '明日'].includes(first);
  const title = items.length > 1
    ? `📝 締切が近い課題が${items.length}件あります`
    : early
      ? `📝 締切まであと${EARLY_REMINDER_DAYS}日の課題があります`
      : `📝 ${first}締切の課題があります`;
  return { title, body: lines.join('\n') };
}

/**
 * 실행 본체 (deadline-reminder Edge Function 이 호출). DB·발송을 주입받아 테스트 가능하게 둔다.
 *   supabase : service_role 클라이언트
 *   send     : async (messages) => tickets[]  (Expo Push API 와 같은 순서·모양)
 * 반환: { users, assignments, sent } — 내용(과제명)은 돌려주지 않는다(로그·응답에 남기지 않게)
 */
export async function runDeadlineReminders(supabase, { now = new Date(), send }) {
  // 후보를 넉넉히 날짜로 거른 뒤(인덱스 활용) 정확한 판정은 pickDueSoon 이 한다
  const from = jstDate(new Date(now.getTime() - 24 * 3600 * 1000));
  const to = jstDate(new Date(now.getTime() + (EARLY_REMINDER_DAYS + 1) * 24 * 3600 * 1000));
  const { data: rows, error } = await supabase
    .from('assignments')
    .select('id, user_id, title, status, due_date, due_at, reminded_at, reminded_3d_at, course_label, courses(name)')
    .eq('status', 'pending')
    .is('reminded_at', null)
    .gte('due_date', from)
    .lte('due_date', to);
  if (error) throw error;

  const soon = pickDueSoon(rows, now);
  const early = pickDueInDays(rows, now);
  const soonIds = new Set(soon.map((a) => a.id));
  const due = [...soon, ...early].sort((x, y) => deadlineOf(x) - deadlineOf(y));
  if (!due.length) return { users: 0, assignments: 0, sent: 0 };

  const userIds = [...new Set(due.map((a) => a.user_id))];
  const { data: optedOut } = await supabase
    .from('profiles').select('id').in('id', userIds).eq('deadline_reminder', false);
  const off = new Set((optedOut ?? []).map((p) => p.id));
  const { data: tokens } = await supabase
    .from('push_tokens').select('user_id, expo_token').in('user_id', userIds);

  const byUser = new Map();
  for (const a of due) {
    if (off.has(a.user_id)) continue;
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id).push(a);
  }

  // 메시지 = (사용자 × 기기 토큰). 토큰이 없는 사람은 보내지 않고 알림 기록도 남기지 않는다
  const messages = [];
  const owners = [];
  for (const [userId, items] of byUser) {
    const msg = buildReminderMessage(items, now);
    for (const t of (tokens ?? []).filter((x) => x.user_id === userId)) {
      messages.push({ to: t.expo_token, title: msg.title, body: msg.body, sound: 'default', data: { type: 'assignment_reminder' } });
      owners.push({ userId, token: t.expo_token });
    }
  }
  if (!messages.length) return { users: 0, assignments: 0, sent: 0 };

  // Expo: 한 요청 100건까지
  const tickets = [];
  for (let i = 0; i < messages.length; i += 100) {
    tickets.push(...((await send(messages.slice(i, i + 100))) ?? []));
  }

  // 한 기기라도 받은 사람의 課題만 「알림 완료」 표시 / 없어진 기기 토큰은 정리
  const delivered = new Set();
  tickets.forEach((t, i) => {
    if (t?.status === 'ok') delivered.add(owners[i].userId);
    else if (t?.details?.error === 'DeviceNotRegistered') {
      supabase.from('push_tokens').delete().eq('expo_token', owners[i].token).then(() => {});
    }
  });
  const ids = due.filter((a) => delivered.has(a.user_id)).map((a) => a.id);
  const soonDone = ids.filter((id) => soonIds.has(id));
  const earlyDone = ids.filter((id) => !soonIds.has(id));
  if (soonDone.length) {
    await supabase.from('assignments').update({ reminded_at: now.toISOString() }).in('id', soonDone);
  }
  if (earlyDone.length) {
    await supabase.from('assignments').update({ reminded_3d_at: now.toISOString() }).in('id', earlyDone);
  }
  return { users: delivered.size, assignments: ids.length, sent: tickets.filter((t) => t?.status === 'ok').length };
}
