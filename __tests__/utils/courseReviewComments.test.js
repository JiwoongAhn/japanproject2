import {
  validateComment,
  groupByReviewId,
  COMMENT_MAX_LENGTH,
} from '../../src/utils/courseReviewComments';

describe('validateComment (보낼 수 있는 댓글인지)', () => {
  test('보통 댓글은 통과하고, 앞뒤 공백은 잘라서 돌려준다', () => {
    expect(validateComment('  私も同じ感想でした  ')).toEqual({
      ok: true,
      body: '私も同じ感想でした',
    });
  });

  test('빈 입력은 막는다', () => {
    expect(validateComment('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateComment(null)).toEqual({ ok: false, reason: 'empty' });
    expect(validateComment(undefined)).toEqual({ ok: false, reason: 'empty' });
  });

  test('공백·줄바꿈만 있는 입력도 막는다(빈 줄이 목록에 생기지 않게)', () => {
    expect(validateComment('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateComment('\n\n')).toEqual({ ok: false, reason: 'empty' });
    expect(validateComment(' \t \n ')).toEqual({ ok: false, reason: 'empty' });
  });

  test('최대 길이까지는 통과, 넘으면 막는다', () => {
    const exact = 'あ'.repeat(COMMENT_MAX_LENGTH);
    expect(validateComment(exact).ok).toBe(true);
    const over = 'あ'.repeat(COMMENT_MAX_LENGTH + 1);
    expect(validateComment(over)).toEqual({ ok: false, reason: 'tooLong' });
  });

  test('길이는 공백을 자른 뒤로 센다', () => {
    const padded = `  ${'あ'.repeat(COMMENT_MAX_LENGTH)}  `;
    expect(validateComment(padded).ok).toBe(true);
  });

  test('전송 중이면 내용과 무관하게 막는다(중복 전송 방지)', () => {
    expect(validateComment('ちゃんとした本文', true)).toEqual({
      ok: false,
      reason: 'sending',
    });
  });
});

describe('groupByReviewId (평가별로 묶기)', () => {
  test('평가 id 별로 나눠 담는다', () => {
    const rows = [
      { id: 'c1', review_id: 'r1', body: 'A' },
      { id: 'c2', review_id: 'r2', body: 'B' },
      { id: 'c3', review_id: 'r1', body: 'C' },
    ];
    const got = groupByReviewId(rows);
    expect(Object.keys(got).sort()).toEqual(['r1', 'r2']);
    expect(got.r1.map(c => c.body)).toEqual(['A', 'C']);
    expect(got.r2.map(c => c.body)).toEqual(['B']);
  });

  test('받은 순서를 그대로 유지한다(조회에서 시간순으로 정렬해 오므로)', () => {
    const rows = [
      { id: 'c1', review_id: 'r1', body: '먼저' },
      { id: 'c2', review_id: 'r1', body: '나중' },
    ];
    expect(groupByReviewId(rows).r1.map(c => c.body)).toEqual(['먼저', '나중']);
  });

  test('댓글이 없으면 빈 객체', () => {
    expect(groupByReviewId([])).toEqual({});
    expect(groupByReviewId(null)).toEqual({});
    expect(groupByReviewId(undefined)).toEqual({});
  });

  test('review_id 가 없는 행은 버린다(키가 undefined 로 생기지 않게)', () => {
    const got = groupByReviewId([
      { id: 'c1', body: '망가진 행' },
      { id: 'c2', review_id: 'r1', body: '정상' },
    ]);
    expect(Object.keys(got)).toEqual(['r1']);
  });
});
