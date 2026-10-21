import { pickHotPosts, hotScore, formatHotTime } from '../../src/utils/boardHot';

const NOW = new Date('2026-10-21T12:00:00+09:00').getTime();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const post = (id, d, likes, comments) => ({
  id, created_at: daysAgo(d), like_count: likes, post_comments: [{ count: comments }],
});

describe('게시판 リアルタイム人気 고르기', () => {
  test('HOT-01: 좋아요+댓글 합계 높은 순 최대 2개', () => {
    const r = pickHotPosts([post('a', 1, 1, 0), post('b', 2, 4, 3), post('c', 3, 2, 2)], { now: NOW });
    expect(r.map((p) => p.id)).toEqual(['b', 'c']);
  });
  test('HOT-02: 7일 지난 글·반응 0 글은 제외', () => {
    const r = pickHotPosts([post('old', 8, 9, 9), post('zero', 1, 0, 0), post('ok', 6, 1, 0)], { now: NOW });
    expect(r.map((p) => p.id)).toEqual(['ok']);
  });
  test('HOT-03: 고를 글이 없으면 빈 배열(칸 숨김)', () => {
    expect(pickHotPosts([post('zero', 1, 0, 0)], { now: NOW })).toEqual([]);
    expect(pickHotPosts(null, { now: NOW })).toEqual([]);
  });
  test('HOT-04: 점수 같으면 최신 글 먼저', () => {
    const r = pickHotPosts([post('older', 3, 2, 0), post('newer', 1, 1, 1)], { now: NOW });
    expect(r.map((p) => p.id)).toEqual(['newer', 'older']);
  });
  test('HOT-05: 점수·시각 표기', () => {
    expect(hotScore({ like_count: 2 })).toBe(2);
    expect(formatHotTime('bad')).toBe('');
    expect(formatHotTime(new Date(2026, 9, 20, 22, 4).toISOString())).toBe('10/20 22:04');
  });
});

describe('7일에 없으면 30일로 넓히기 (2026-10-21 실데이터 검증)', () => {
  const { pickHotWithFallback } = require('../../src/utils/boardHot');
  test('HOT-06: 7일 안에 있으면 7일', () => {
    const r = pickHotWithFallback([post('new', 2, 1, 0), post('old', 20, 9, 9)], { now: NOW });
    expect(r).toEqual({ posts: [expect.objectContaining({ id: 'new' })], days: 7 });
  });
  test('HOT-07: 7일 안에 반응 글이 없으면 30일에서 고른다', () => {
    const r = pickHotWithFallback([post('zero', 1, 0, 0), post('old', 20, 2, 0), post('tooOld', 40, 9, 9)], { now: NOW });
    expect(r.days).toBe(30);
    expect(r.posts.map((p) => p.id)).toEqual(['old']);
  });
  test('HOT-08: 30일에도 없으면 빈 배열', () => {
    expect(pickHotWithFallback([post('tooOld', 40, 9, 9)], { now: NOW }).posts).toEqual([]);
  });
});
