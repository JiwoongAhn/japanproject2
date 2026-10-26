import {
  classifyAssignmentMail,
  parseManabaAssignmentMail,
  parseDeadline,
  matchCourseId,
  normalizeCourseName,
  assignmentPushNote,
  syncAssignmentFromMail,
} from '../../supabase/functions/_shared/manabaAssignment';

// 실메일 양식(2026-10-21 운영 DB 확인) 그대로 — 과목·課題명만 바꿨다
const FOOTER = `
manaba にログインし、内容を確認してください。
PC : https://kokushikan.manaba.jp/ct/course_1_report_2

※このメールは manaba が自動送信しています。返信はできません。
`;

const publishMail = {
  subject: 'manaba - コンピュータリテラシー - レポート公開のお知らせ',
  bodyHtml: `manaba からのお知らせです。
[コンピュータリテラシー] に、新しくレポートが公開されました。

--レポート情報--
[コース名] : コンピュータリテラシー
[課題名] : 練習問題3　情報検索
[受付終了日時] : 2026-10-15 16:25:00
----------------
${FOOTER}`,
};

const quizPublishMail = {
  subject: 'manaba - ヨーロッパの歴史と文化 - 小テスト公開のお知らせ',
  bodyHtml: `manaba からのお知らせです。
--小テスト情報--
[コース名] : ヨーロッパの歴史と文化
[課題名] : 第3回 確認テスト
[受付開始日時] : 2026-10-04 00:00:00
[受付終了日時] : 2026-10-11 23:55:00
${FOOTER}`,
};

const quizSubmitMail = {
  subject: 'manaba - スポーツ実習Ⅱ　テニス - 小テスト提出のお知らせ',
  bodyHtml: `manaba からのお知らせです。
[スポーツ実習Ⅱ　テニス] に課題が提出されました。

----小テスト情報----
[コース名] : スポーツ実習Ⅱ　テニス
[課題名] : 第1回　９月21日授業
----------------
${FOOTER}`,
};

const unsubmitMail = {
  subject: 'manaba - 現代社会論 - レポート提出取消(再提出)のお知らせ',
  bodyHtml: `manaba からのお知らせです。
----レポート情報----
[コース名] : 現代社会論
[課題名] : 中間レポート
[提出者] : 山田
[受付終了日時] : 2026-10-19 15:00:00
${FOOTER}`,
};

const newsMail = {
  subject: 'manaba - 現代社会論 - コースニュースのお知らせ',
  bodyHtml: `[コース名] : 現代社会論\n[タイトル] : 休講のお知らせ\n[作成者] : 教員\n${FOOTER}`,
};

const surveyMail = {
  subject: 'manaba - 2026年度学生調査（全国学生調査... - アンケート公開のお知らせ',
  bodyHtml: `[コース名] : 2026年度学生調査（全国学生調査）\n[課題名] : 学生調査\n[受付終了日時] : 2027-04-01 00:00:00\n${FOOTER}`,
};

describe('classifyAssignmentMail — 제목으로 종류 판정', () => {
  test('MA-01 レポート/小テスト 公開 = publish', () => {
    expect(classifyAssignmentMail(publishMail.subject)).toBe('publish');
    expect(classifyAssignmentMail(quizPublishMail.subject)).toBe('publish');
  });
  test('MA-02 提出 = submit / 提出取消 = unsubmit (取消가 먼저 판정돼야 함)', () => {
    expect(classifyAssignmentMail(quizSubmitMail.subject)).toBe('submit');
    expect(classifyAssignmentMail(unsubmitMail.subject)).toBe('unsubmit');
  });
  test('MA-03 ニュース·スレッド·成績公開·アンケート未提出(독촉)·빈 값은 대상 아님', () => {
    expect(classifyAssignmentMail(newsMail.subject)).toBeNull();
    expect(classifyAssignmentMail('manaba - 法学 - スレッド投稿のお知らせ')).toBeNull();
    expect(classifyAssignmentMail('manaba - 現代の論理 - 成績公開のお知らせ')).toBeNull();
    expect(classifyAssignmentMail('manaba - 2026年度学生調査（全国学生調査... - アンケート未提出のお知らせ')).toBeNull();
    expect(classifyAssignmentMail(undefined)).toBeNull();
  });
  test('MA-03b アンケート公開 은 publish (과목 필터는 sync 단계)', () => {
    expect(classifyAssignmentMail(surveyMail.subject)).toBe('publish');
  });
  test('MA-03c 제목 양식이 달라도 본문 문장으로 提出/取消 판정', () => {
    expect(classifyAssignmentMail('manaba - 経済学 - お知らせ', '[経済学] に課題が提出されました。')).toBe('submit');
    expect(classifyAssignmentMail('manaba - 経済学 - お知らせ', '課題 [A] が未提出状態に戻りました。')).toBe('unsubmit');
    expect(classifyAssignmentMail('manaba - 経済学 - レポート提出完了のお知らせ')).toBe('submit');
  });
});

describe('parseDeadline — JST 마감', () => {
  test('MA-04 일반 시각은 그날', () => {
    expect(parseDeadline('2026-10-15 16:25:00')).toEqual({
      dueAt: '2026-10-15T16:25:00+09:00',
      dueDate: '2026-10-15',
    });
  });
  test('MA-05 0:00 마감은 전날까지로 본다', () => {
    expect(parseDeadline('2026-10-27 00:00:00').dueDate).toBe('2026-10-26');
    expect(parseDeadline('2026-11-01 00:00:00').dueDate).toBe('2026-10-31'); // 월 경계
  });
  test('MA-06 23:59·23:55 는 그날 / 초 없는 형식도 읽음', () => {
    expect(parseDeadline('2026-10-15 23:59:00').dueDate).toBe('2026-10-15');
    expect(parseDeadline('2026-10-11 23:55').dueAt).toBe('2026-10-11T23:55:00+09:00');
  });
  test('MA-07 없거나 형식이 다르면 null', () => {
    expect(parseDeadline(null)).toEqual({ dueAt: null, dueDate: null });
    expect(parseDeadline('来週まで')).toEqual({ dueAt: null, dueDate: null });
  });
});

describe('parseManabaAssignmentMail', () => {
  test('MA-08 レポート公開 → 과목·제목·마감', () => {
    expect(parseManabaAssignmentMail(publishMail)).toEqual({
      action: 'publish',
      kind: 'report',
      courseLabel: 'コンピュータリテラシー',
      title: '練習問題3　情報検索',
      dueAt: '2026-10-15T16:25:00+09:00',
      dueDate: '2026-10-15',
      sourceKey: 'コンピュータリテラシー|練習問題3情報検索',
    });
  });
  test('MA-09 마감 없는 提出 메일도 읽힌다 (마감은 null)', () => {
    const r = parseManabaAssignmentMail(quizSubmitMail);
    expect(r.action).toBe('submit');
    expect(r.dueAt).toBeNull();
    expect(r.title).toBe('第1回　９月21日授業');
  });
  test('MA-10 공개 메일과 제출 메일은 같은 sourceKey (전각 숫자·공백 차이 무시)', () => {
    const published = parseManabaAssignmentMail({
      subject: 'manaba - スポーツ実習Ⅱ テニス - 小テスト公開のお知らせ',
      bodyHtml: '[コース名]：スポーツ実習II テニス\n[課題名]：第1回 9月21日授業\n[受付終了日時]：2026-09-28 23:59:00',
    });
    expect(published.sourceKey).toBe(parseManabaAssignmentMail(quizSubmitMail).sourceKey);
  });
  test('MA-11 대상 아닌 메일 / 課題名 없는 메일은 null', () => {
    expect(parseManabaAssignmentMail(newsMail)).toBeNull();
    expect(parseManabaAssignmentMail(surveyMail).kind).toBe('survey');
    expect(parseManabaAssignmentMail(quizPublishMail).kind).toBe('quiz');
    expect(parseManabaAssignmentMail({ subject: publishMail.subject, bodyHtml: 'manaba' })).toBeNull();
    expect(parseManabaAssignmentMail()).toBeNull();
  });
  test('MA-12 본문에 コース名 이 없으면 제목에서', () => {
    const r = parseManabaAssignmentMail({
      subject: publishMail.subject,
      bodyHtml: '[課題名] : 課題A\n[受付終了日時] : 2026-10-15 16:25:00',
    });
    expect(r.courseLabel).toBe('コンピュータリテラシー');
  });
  test('MA-12b 課題名에 「小テスト」 가 있어도 レポート 메일이면 report (実メール)', () => {
    const r = parseManabaAssignmentMail({
      subject: 'manaba - 現代社会論 - レポート公開のお知らせ',
      bodyHtml: '--レポート情報--\n[コース名] : 現代社会論\n[課題名] : 10月22日小テスト\n[受付終了日時] : 2026-10-22 16:10:00',
    });
    expect(r.kind).toBe('report');
  });
  test('MA-13 HTML 메일도 읽는다', () => {
    const r = parseManabaAssignmentMail({
      subject: publishMail.subject,
      bodyHtml: '<p>[コース名] : 経済学Ａ<br>[課題名] : 第2回&amp;第3回<br>[受付終了日時] : 2026-10-15 16:25:00</p>',
    });
    expect(r.courseLabel).toBe('経済学Ａ');
    expect(r.title).toBe('第2回&第3回');
  });
});

describe('matchCourseId — 시간표 과목 연결', () => {
  const courses = [
    { id: 'c1', name: '実用日本語２' },
    { id: 'c2', name: 'スポーツ実習Ⅵ　テニス' },
    { id: 'c3', name: '実用日本語２' }, // 주 2회 수업은 행이 여러 개
  ];
  test('MA-14 전각/반각 차이는 같은 과목', () => {
    expect(matchCourseId('実用日本語2', courses)).toBe('c1');
  });
  test('MA-15 비슷하기만 하면 연결하지 않는다 (Ⅱ ≠ Ⅵ)', () => {
    expect(matchCourseId('スポーツ実習Ⅱ　テニス', courses)).toBeNull();
  });
  test('MA-16 빈 값 안전', () => {
    expect(matchCourseId(null, courses)).toBeNull();
    expect(matchCourseId('実用日本語２', null)).toBeNull();
    expect(normalizeCourseName(undefined)).toBe('');
  });
});

describe('assignmentPushNote — 푸시 한 줄', () => {
  test('MA-17 publish 는 마감 표시', () => {
    expect(assignmentPushNote(parseManabaAssignmentMail(publishMail)))
      .toBe('📝 課題に追加しました（締切 10/15 16:25）');
  });
  test('MA-18 submit / 그 외', () => {
    expect(assignmentPushNote(parseManabaAssignmentMail(quizSubmitMail))).toBe('✅ 課題を「提出済」にしました');
    expect(assignmentPushNote(parseManabaAssignmentMail(unsubmitMail))).toBeNull();
    expect(assignmentPushNote(null)).toBeNull();
  });
});

// ── 가짜 Supabase (메모리 DB) — mail-inbound 가 쓰는 체인만 흉내 낸다 ──
//   from().select().eq().maybeSingle() / insert() / update().eq()[.select()]
//   (user_id, source_key) 유니크 위반 시 23505 — 실제 DB 제약과 같게
function fakeSupabase(tables, { failOn } = {}) {
  let seq = 0;
  return {
    from(table) {
      const rows = (tables[table] ??= []);
      const filters = [];
      let op = 'select';
      let patch = null;
      let wantRows = false;
      const match = (r) => filters.every(([k, v]) => r[k] === v);
      const run = () => {
        if (failOn === `${table}.${op}`) return { data: null, error: { message: 'boom' } };
        if (op === 'update') {
          const hit = rows.filter(match);
          hit.forEach((r) => Object.assign(r, patch));
          return { data: wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null };
        }
        return { data: rows.filter(match), error: null };
      };
      const q = {
        select() { wantRows = true; return q; },
        eq(k, v) { filters.push([k, v]); return q; },
        update(p) { op = 'update'; patch = p; return q; },
        insert(row) {
          op = 'insert';
          if (failOn === `${table}.insert`) return Promise.resolve({ error: { message: 'boom' } });
          if (row.source_key && rows.some((r) => r.user_id === row.user_id && r.source_key === row.source_key)) {
            return Promise.resolve({ error: { code: '23505', message: 'dup' } });
          }
          rows.push({ id: `a${++seq}`, ...row });
          return Promise.resolve({ error: null });
        },
        maybeSingle() {
          const r = run();
          return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
        },
        then(res, rej) { return Promise.resolve(run()).then(res, rej); },
      };
      return q;
    },
  };
}

describe('syncAssignmentFromMail — mail-inbound 의 DB 반영', () => {
  const U = 'user-1';
  const base = () => ({
    courses: [{ id: 'c-lit', name: 'コンピュータリテラシー', user_id: U }],
    assignments: [],
  });
  // 가짜 DB 는 courses 를 user_id 로 거른다
  const course = (t) => t.courses;

  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => console.error.mockRestore());

  test('MA-19 公開 메일 → 未提出 課題 1건 추가 (과목 연결·마감 시각·출처)', async () => {
    const t = base();
    const note = await syncAssignmentFromMail(fakeSupabase(t), U, 'n1', publishMail.subject, publishMail.bodyHtml);
    expect(note).toBe('📝 課題に追加しました（締切 10/15 16:25）');
    expect(t.assignments).toHaveLength(1);
    expect(t.assignments[0]).toMatchObject({
      user_id: U, course_id: 'c-lit', course_label: 'コンピュータリテラシー',
      title: '練習問題3　情報検索', due_date: '2026-10-15', due_at: '2026-10-15T16:25:00+09:00',
      status: 'pending', source: 'manaba', source_notice_id: 'n1',
    });
    expect(course(t)).toHaveLength(1);
  });

  test('MA-20 같은 課題 재공개 → 중복 없이 마감만 갱신, 提出済 는 유지', async () => {
    const t = base();
    const db = fakeSupabase(t);
    await syncAssignmentFromMail(db, U, 'n1', publishMail.subject, publishMail.bodyHtml);
    t.assignments[0].status = 'submitted';
    t.assignments[0].reminded_at = '2026-10-14T09:00:00Z'; // 이미 締切前日 알림을 보낸 상태
    const changed = publishMail.bodyHtml.replace('2026-10-15 16:25:00', '2026-10-20 23:59:00');
    await syncAssignmentFromMail(db, U, 'n2', publishMail.subject, changed);
    expect(t.assignments).toHaveLength(1);
    expect(t.assignments[0]).toMatchObject({ due_date: '2026-10-20', status: 'submitted', source_notice_id: 'n2', reminded_at: null, reminded_3d_at: null });
  });

  test('MA-21 公開 → 提出 → 提出取消 순서로 상태가 따라간다', async () => {
    const t = base();
    const db = fakeSupabase(t);
    const pub = {
      subject: 'manaba - 現代社会論 - レポート公開のお知らせ',
      bodyHtml: '[コース名] : 現代社会論\n[課題名] : 中間レポート\n[受付終了日時] : 2026-10-19 15:00:00',
    };
    const sub = {
      subject: 'manaba - 現代社会論 - レポート提出のお知らせ',
      bodyHtml: '[コース名] : 現代社会論\n[課題名] : 中間レポート\n[提出者] : 山田',
    };
    await syncAssignmentFromMail(db, U, 'n1', pub.subject, pub.bodyHtml);
    expect(t.assignments[0].status).toBe('pending');
    expect(await syncAssignmentFromMail(db, U, 'n2', sub.subject, sub.bodyHtml)).toBe('✅ 課題を「提出済」にしました');
    expect(t.assignments[0].status).toBe('submitted');
    await syncAssignmentFromMail(db, U, 'n3', unsubmitMail.subject, unsubmitMail.bodyHtml);
    expect(t.assignments[0].status).toBe('pending');
    expect(t.assignments[0].course_id).toBeNull(); // 시간표에 없는 과목 → 과목명만
  });

  test('MA-22 앱에 없는 課題의 提出 메일 → 아무것도 안 함 (null)', async () => {
    const t = base();
    expect(await syncAssignmentFromMail(fakeSupabase(t), U, 'n1', quizSubmitMail.subject, quizSubmitMail.bodyHtml)).toBeNull();
    expect(t.assignments).toHaveLength(0);
  });

  test('MA-23 다른 사용자의 課題는 건드리지 않는다', async () => {
    const t = base();
    const db = fakeSupabase(t);
    await syncAssignmentFromMail(db, 'other', 'n1', publishMail.subject, publishMail.bodyHtml);
    await syncAssignmentFromMail(db, U, 'n2', publishMail.subject, publishMail.bodyHtml);
    expect(t.assignments).toHaveLength(2);
    expect(t.assignments.map((a) => a.user_id).sort()).toEqual(['other', U].sort());
  });

  test('MA-24 ニュース·アンケート·마감 없는 公開 → 추가 안 함', async () => {
    const t = base();
    const db = fakeSupabase(t);
    expect(await syncAssignmentFromMail(db, U, 'n1', newsMail.subject, newsMail.bodyHtml)).toBeNull();
    expect(await syncAssignmentFromMail(db, U, 'n2', surveyMail.subject, surveyMail.bodyHtml)).toBeNull();
    expect(await syncAssignmentFromMail(db, U, 'n3', publishMail.subject, '[課題名] : 締切なし')).toBeNull();
    expect(t.assignments).toHaveLength(0);
  });

  test('MA-24b 수업 アンケート(리액션페이퍼)는 내 시간표 과목이면 추가', async () => {
    const t = base();
    t.courses.push({ id: 'c-vol', name: 'ボランティア活動の方法と実践', user_id: U });
    const mail = {
      subject: 'manaba - ボランティア活動の方法と実践 - アンケート公開のお知らせ',
      bodyHtml: '--アンケート情報--\n[コース名] : ボランティア活動の方法と実践\n[課題名] : 第1回授業リアクションペーパー\n[受付終了日時] : 2026-10-03 00:00:00',
    };
    expect(await syncAssignmentFromMail(fakeSupabase(t), U, 'n1', mail.subject, mail.bodyHtml))
      .toBe('📝 課題に追加しました（締切 10/02 24:00）');
    expect(t.assignments[0]).toMatchObject({ course_id: 'c-vol', due_date: '2026-10-02' });
  });

  test('MA-25 DB 오류가 나도 throw 하지 않고 null (통지 푸시는 계속 나간다)', async () => {
    for (const failOn of ['assignments.select', 'assignments.insert']) {
      const t = base();
      await expect(
        syncAssignmentFromMail(fakeSupabase(t, { failOn }), U, 'n1', publishMail.subject, publishMail.bodyHtml),
      ).resolves.toBeNull();
    }
    await expect(syncAssignmentFromMail(null, U, 'n1', publishMail.subject, publishMail.bodyHtml)).resolves.toBeNull();
  });

  test('MA-26 동시에 같은 메일 2통(유니크 위반 23505) → 1건만, 둘 다 성공 문구', async () => {
    const t = base();
    const db = fakeSupabase(t);
    const [a, b] = await Promise.all([
      syncAssignmentFromMail(db, U, 'n1', publishMail.subject, publishMail.bodyHtml),
      syncAssignmentFromMail(db, U, 'n2', publishMail.subject, publishMail.bodyHtml),
    ]);
    expect(t.assignments).toHaveLength(1);
    expect(a).toBe(b);
  });
});
