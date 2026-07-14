import { mergeNotices, countUnreadPush } from '../../src/utils/manabaMerge';

// push 공지 정규화 결과를 흉내낸 최소 형태
const push = (over = {}) => ({
  title: 'お知らせ',
  href: null,
  date: '2026-07-15',
  _source: 'push',
  _id: 'id-1',
  ...over,
});

const web = (over = {}) => ({
  title: 'ホーム掲示',
  href: 'https://kokushikan.manaba.jp/ct/course_1_news_1',
  date: '2026-07-14',
  ...over,
});

describe('mergeNotices', () => {
  it('push와 web 공지를 합치고 각 항목에 _source를 붙인다', () => {
    const merged = mergeNotices([push()], [web()], []);
    expect(merged).toHaveLength(2);
    expect(merged[0]._source).toBe('push');
    expect(merged[1]._source).toBe('web');
  });

  it('URL이 겹치는 web 공지는 제거하고 push를 우선한다', () => {
    const url = 'https://kokushikan.manaba.jp/ct/course_9_news_9';
    const merged = mergeNotices([push({ href: url })], [web({ href: url })], []);
    expect(merged).toHaveLength(1);
    expect(merged[0]._source).toBe('push');
  });

  it('既読(삭제)한 web 공지는 숨긴다', () => {
    const w = web();
    const merged = mergeNotices([], [w], [w.href]);
    expect(merged).toHaveLength(0);
  });

  it('既読한 push 공지도 숨긴다 — DB 실패 시에도 부활 방지(버그 ①)', () => {
    const p = push({ href: 'https://kokushikan.manaba.jp/ct/course_5_news_5' });
    // fetchUnreadNotices가 아직 읽음 반영 안 돼 다시 넘어와도(=DB 미반영),
    // dismissedKeys에 있으면 화면에서 사라져야 한다.
    const merged = mergeNotices([p], [], [p.href]);
    expect(merged).toHaveLength(0);
  });

  it('href가 없는 공지는 title|date 조합 키로 숨긴다', () => {
    const w = web({ href: null, title: '天気', date: '2026-07-10' });
    const merged = mergeNotices([], [w], ['天気|2026-07-10']);
    expect(merged).toHaveLength(0);
  });

  it('빈 입력에도 안전하게 빈 배열을 반환한다', () => {
    expect(mergeNotices()).toEqual([]);
  });
});

describe('countUnreadPush', () => {
  it('병합 결과에서 push 소스만 센다 = 홈 배지와 목록 항목 수 일치(버그 ③)', () => {
    const merged = mergeNotices([push()], [web()], []);
    expect(countUnreadPush(merged)).toBe(1);
  });

  it('既読 처리된 push는 카운트에서도 빠진다', () => {
    const p = push({ href: 'https://x/news_1' });
    const merged = mergeNotices([p], [], [p.href]);
    expect(countUnreadPush(merged)).toBe(0);
  });
});
