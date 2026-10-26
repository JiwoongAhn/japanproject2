import {
  deadlineOf,
  pickDueSoon,
  pickDueInDays,
  deadlineLabel,
  buildReminderMessage,
  runDeadlineReminders,
} from '../../supabase/functions/_shared/deadlineReminder';

// 실행 시각 = cron 과 같은 JST 18:00 (2026-10-26 월)
const NOW = new Date('2026-10-26T18:00:00+09:00');

const a = (over) => ({
  id: over.id ?? 'x', user_id: 'u1', title: '課題', status: 'pending', reminded_at: null, reminded_3d_at: null,
  due_date: '2026-10-27', due_at: null, course_label: null, courses: null, ...over,
});

describe('deadlineOf — 실제 마감 시각', () => {
  test('DR-01 시각 있으면 그대로 / 수동 등록은 마감일 23:59:59 JST', () => {
    expect(deadlineOf(a({ due_at: '2026-10-27T16:25:00+09:00' })).toISOString()).toBe('2026-10-27T07:25:00.000Z');
    expect(deadlineOf(a({ due_date: '2026-10-27' })).toISOString()).toBe('2026-10-27T14:59:59.000Z');
    expect(deadlineOf({})).toBeNull();
  });
});

describe('pickDueSoon — 18:00 실행 시 알릴 대상', () => {
  const list = [
    a({ id: 'tonight', due_date: '2026-10-26', due_at: '2026-10-26T23:59:00+09:00' }),
    a({ id: 'tomorrowAM', due_date: '2026-10-27', due_at: '2026-10-27T09:00:00+09:00' }),
    a({ id: 'tomorrowManual', due_date: '2026-10-27' }),
    a({ id: 'midnight', due_date: '2026-10-27', due_at: '2026-10-28T00:00:00+09:00' }), // 「明日 24:00」
    a({ id: 'dayAfter', due_date: '2026-10-28', due_at: '2026-10-28T12:00:00+09:00' }),
    a({ id: 'passed', due_date: '2026-10-26', due_at: '2026-10-26T16:25:00+09:00' }),
    a({ id: 'submitted', status: 'submitted' }),
    a({ id: 'already', reminded_at: '2026-10-25T09:00:00Z' }),
  ];
  test('DR-02 오늘 밤·내일(24:00 포함)만, 마감 순', () => {
    expect(pickDueSoon(list, NOW).map((x) => x.id))
      .toEqual(['tonight', 'tomorrowAM', 'tomorrowManual', 'midnight']);
  });
  test('DR-03 모레·이미 지난 것·提出済·이미 알린 것 제외', () => {
    const ids = pickDueSoon(list, NOW).map((x) => x.id);
    for (const id of ['dayAfter', 'passed', 'submitted', 'already']) expect(ids).not.toContain(id);
  });
  test('DR-04 빈 값 안전', () => {
    expect(pickDueSoon(null, NOW)).toEqual([]);
  });
});

describe('deadlineLabel / buildReminderMessage — 알림 문구', () => {
  test('DR-05 今日/明日 + 시각, 수동은 「まで」, 0:00 마감은 전날 24:00', () => {
    expect(deadlineLabel(a({ due_date: '2026-10-26', due_at: '2026-10-26T23:59:00+09:00' }), NOW)).toBe('今日 23:59');
    expect(deadlineLabel(a({ due_date: '2026-10-27', due_at: '2026-10-27T16:25:00+09:00' }), NOW)).toBe('明日 16:25');
    expect(deadlineLabel(a({ due_date: '2026-10-27' }), NOW)).toBe('明日まで');
    expect(deadlineLabel(a({ due_date: '2026-10-27', due_at: '2026-10-28T00:00:00+09:00' }), NOW)).toBe('明日 24:00');
  });
  test('DR-06 1건 — 제목에 날, 본문에 과목「課題」', () => {
    const m = buildReminderMessage([a({ title: '第5回レポート', courses: { name: '経営学概論' }, due_at: '2026-10-27T23:59:00+09:00' })], NOW);
    expect(m).toEqual({ title: '📝 明日締切の課題があります', body: '明日 23:59｜経営学概論「第5回レポート」' });
  });
  test('DR-07 여러 건 — 건수 제목, 3줄까지 + 「ほか」, 시간표에 없는 과목은 course_label', () => {
    const items = [1, 2, 3, 4, 5].map((n) => a({ id: `n${n}`, title: `課題${n}`, course_label: `科目${n}` }));
    const m = buildReminderMessage(items, NOW);
    expect(m.title).toBe('📝 締切が近い課題が5件あります');
    expect(m.body.split('\n')).toEqual([
      '明日まで｜科目1「課題1」', '明日まで｜科目2「課題2」', '明日まで｜科目3「課題3」', 'ほか2件',
    ]);
  });
  test('DR-08 과목명 없으면 제목만 / 빈 목록은 null', () => {
    expect(buildReminderMessage([a({ title: 'T' })], NOW).body).toBe('明日まで｜T');
    expect(buildReminderMessage([], NOW)).toBeNull();
  });
});

// ── 가짜 DB — deadline-reminder 가 쓰는 체인만 (select/eq/is/gte/lte/in/update/delete) ──
function fakeDb(t) {
  return {
    from(table) {
      const rows = t[table];
      const f = [];
      let op = 'select';
      let patch;
      const ok = (r) => f.every(([k, kind, v]) =>
        kind === 'eq' ? r[k] === v : kind === 'is' ? (r[k] ?? null) === v : kind === 'gte' ? r[k] >= v
          : kind === 'lte' ? r[k] <= v : kind === 'in' ? v.includes(r[k]) : true);
      const run = () => {
        const hit = rows.filter(ok);
        if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
        if (op === 'delete') hit.forEach((r) => rows.splice(rows.indexOf(r), 1));
        return { data: hit, error: null };
      };
      const q = {
        select: () => q,
        eq: (k, v) => (f.push([k, 'eq', v]), q),
        is: (k, v) => (f.push([k, 'is', v]), q),
        gte: (k, v) => (f.push([k, 'gte', v]), q),
        lte: (k, v) => (f.push([k, 'lte', v]), q),
        in: (k, v) => (f.push([k, 'in', v]), q),
        update: (p) => ((op = 'update'), (patch = p), q),
        delete: () => ((op = 'delete'), q),
        then: (res, rej) => Promise.resolve(run()).then(res, rej),
      };
      return q;
    },
  };
}

describe('runDeadlineReminders — 실행 본체', () => {
  const base = () => ({
    assignments: [
      a({ id: 'a1', user_id: 'u1', title: 'レポート', course_label: '経営学', due_at: '2026-10-27T23:59:00+09:00' }),
      a({ id: 'a2', user_id: 'u1', title: '小テスト', due_date: '2026-10-26', due_at: '2026-10-26T23:00:00+09:00' }),
      a({ id: 'b1', user_id: 'u2', title: '感想', due_date: '2026-10-27' }),
      a({ id: 'c1', user_id: 'u3', title: 'OFFの人', due_date: '2026-10-27' }),
      a({ id: 'd1', user_id: 'u4', title: '토큰없음', due_date: '2026-10-27' }),
      a({ id: 'z1', user_id: 'u1', title: '来週', due_date: '2026-11-02' }),
    ],
    profiles: [{ id: 'u3', deadline_reminder: false }, { id: 'u1', deadline_reminder: true }],
    push_tokens: [
      { user_id: 'u1', expo_token: 'T1a' }, { user_id: 'u1', expo_token: 'T1b' },
      { user_id: 'u2', expo_token: 'T2' }, { user_id: 'u3', expo_token: 'T3' },
    ],
  });

  test('DR-09 사람당 1통(기기마다), OFF·토큰 없는 사람 제외, 보낸 課題만 reminded_at', async () => {
    const t = base();
    const sent = [];
    const r = await runDeadlineReminders(fakeDb(t), {
      now: NOW,
      send: async (msgs) => { sent.push(...msgs); return msgs.map(() => ({ status: 'ok' })); },
    });
    expect(sent.map((m) => m.to)).toEqual(['T1a', 'T1b', 'T2']);
    expect(sent[0]).toMatchObject({ title: '📝 締切が近い課題が2件あります', data: { type: 'assignment_reminder' } });
    expect(sent[0].body).toBe('今日 23:00｜小テスト\n明日 23:59｜経営学「レポート」');
    expect(r).toEqual({ users: 2, assignments: 3, sent: 3 });
    const reminded = t.assignments.filter((x) => x.reminded_at).map((x) => x.id).sort();
    expect(reminded).toEqual(['a1', 'a2', 'b1']);
  });

  test('DR-10 두 번 실행해도 다시 보내지 않는다', async () => {
    const t = base();
    const send = jest.fn(async (msgs) => msgs.map(() => ({ status: 'ok' })));
    await runDeadlineReminders(fakeDb(t), { now: NOW, send });
    const again = await runDeadlineReminders(fakeDb(t), { now: NOW, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(again.sent).toBe(0);
  });

  test('DR-11 발송 실패한 사람은 표시하지 않아 다음 실행에 다시 시도 / 없어진 기기는 토큰 삭제', async () => {
    const t = base();
    await runDeadlineReminders(fakeDb(t), {
      now: NOW,
      send: async (msgs) => msgs.map((m) => (m.to === 'T2'
        ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })),
    });
    expect(t.assignments.find((x) => x.id === 'b1').reminded_at).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.push_tokens.map((x) => x.expo_token)).not.toContain('T2');
  });

  test('DR-12 대상이 없으면 아무것도 보내지 않는다', async () => {
    const send = jest.fn();
    const r = await runDeadlineReminders(fakeDb({ assignments: [], profiles: [], push_tokens: [] }), { now: NOW, send });
    expect(r).toEqual({ users: 0, assignments: 0, sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});

// ── 3日前 알림 (2026-10-27 추가) — NOW(10/26 18:00) 기준 3일 뒤 = 10/29 ──
describe('3日前 알림', () => {
  test('DR-13 마감일이 정확히 3일 뒤인 未提出만, 0:00 마감(전날 24:00)도 날짜 기준', () => {
    const list = [
      a({ id: 'd3', due_date: '2026-10-29', due_at: '2026-10-29T23:59:00+09:00' }),
      a({ id: 'd3manual', due_date: '2026-10-29' }),
      a({ id: 'd3midnight', due_date: '2026-10-29', due_at: '2026-10-30T00:00:00+09:00' }),
      a({ id: 'd2', due_date: '2026-10-28' }),
      a({ id: 'd4', due_date: '2026-10-30' }),
      a({ id: 'd3done', due_date: '2026-10-29', status: 'submitted' }),
      a({ id: 'd3sent', due_date: '2026-10-29', reminded_3d_at: '2026-10-26T09:00:00Z' }),
    ];
    expect(pickDueInDays(list, NOW).map((x) => x.id)).toEqual(['d3', 'd3manual', 'd3midnight']);
  });

  test('DR-14 1건이면 「あと3日」 제목 + 날짜 표시', () => {
    const m = buildReminderMessage([a({ title: 'レポート', course_label: '経営学', due_date: '2026-10-29', due_at: '2026-10-29T23:59:00+09:00' })], NOW);
    expect(m).toEqual({ title: '📝 締切まであと3日の課題があります', body: '10/29 23:59｜経営学「レポート」' });
  });

  test('DR-15 3日前 → (이틀 뒤) 前日, 같은 課題에 정확히 2번 / 중간에 提出하면 前日 알림 없음', async () => {
    const t = {
      assignments: [
        a({ id: 'keep', title: '出さない', due_date: '2026-10-29', due_at: '2026-10-29T23:59:00+09:00' }),
        a({ id: 'done', title: '出す', due_date: '2026-10-29' }),
      ],
      profiles: [],
      push_tokens: [{ user_id: 'u1', expo_token: 'T1' }],
    };
    const sent = [];
    const send = async (msgs) => { sent.push(...msgs); return msgs.map(() => ({ status: 'ok' })); };
    const day = (d) => new Date(`2026-10-${d}T18:00:00+09:00`);

    await runDeadlineReminders(fakeDb(t), { now: day(26), send }); // 3日前
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe('📝 締切が近い課題が2件あります');
    expect(t.assignments.every((x) => x.reminded_3d_at && !x.reminded_at)).toBe(true);

    t.assignments.find((x) => x.id === 'done').status = 'submitted';
    await runDeadlineReminders(fakeDb(t), { now: day(27), send }); // 중간날 — 없음
    expect(sent).toHaveLength(1);

    await runDeadlineReminders(fakeDb(t), { now: day(28), send }); // 前日
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ title: '📝 明日締切の課題があります', body: '明日 23:59｜出さない' });

    await runDeadlineReminders(fakeDb(t), { now: day(29), send }); // 당일 — 이미 알림
    expect(sent).toHaveLength(2);
  });

  test('DR-16 이틀 전에 추가된 課題는 3日前 알림을 몰아서 보내지 않고 前日만', async () => {
    const t = {
      assignments: [a({ id: 'late', title: '遅れて追加', due_date: '2026-10-28' })],
      profiles: [], push_tokens: [{ user_id: 'u1', expo_token: 'T1' }],
    };
    const sent = [];
    const send = async (msgs) => { sent.push(...msgs); return msgs.map(() => ({ status: 'ok' })); };
    await runDeadlineReminders(fakeDb(t), { now: NOW, send }); // 10/26 = 이틀 전
    expect(sent).toHaveLength(0);
    await runDeadlineReminders(fakeDb(t), { now: new Date('2026-10-27T18:00:00+09:00'), send });
    expect(sent.map((m) => m.title)).toEqual(['📝 明日締切の課題があります']);
  });

  test('DR-17 前日과 3日前이 같은 날 겹치면 한 통으로, 기록은 각각', async () => {
    const t = {
      assignments: [
        a({ id: 'soon', title: '明日の', due_date: '2026-10-27' }),
        a({ id: 'early', title: '3日後の', due_date: '2026-10-29' }),
      ],
      profiles: [], push_tokens: [{ user_id: 'u1', expo_token: 'T1' }],
    };
    const sent = [];
    await runDeadlineReminders(fakeDb(t), {
      now: NOW, send: async (msgs) => { sent.push(...msgs); return msgs.map(() => ({ status: 'ok' })); },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toBe('明日まで｜明日の\n10/29まで｜3日後の');
    expect(t.assignments.find((x) => x.id === 'soon')).toMatchObject({ reminded_3d_at: null });
    expect(t.assignments.find((x) => x.id === 'soon').reminded_at).toBeTruthy();
    expect(t.assignments.find((x) => x.id === 'early')).toMatchObject({ reminded_at: null });
    expect(t.assignments.find((x) => x.id === 'early').reminded_3d_at).toBeTruthy();
  });
});
