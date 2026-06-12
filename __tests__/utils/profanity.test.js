import { findProfanity, findProfanityInAny, containsProfanity } from '../../src/utils/profanity';

describe('findProfanity', () => {
  test('금칙어가 없으면 null', () => {
    expect(findProfanity('今日の授業はとても良かったです')).toBeNull();
    expect(findProfanity('テスト勉強がんばろう！')).toBeNull();
  });

  test('빈 값/공백은 null', () => {
    expect(findProfanity('')).toBeNull();
    expect(findProfanity(null)).toBeNull();
    expect(findProfanity('   ')).toBeNull();
  });

  test('일본어 금칙어 감지', () => {
    expect(findProfanity('お前なんか死ね')).toBe('死ね');
    expect(findProfanity('まじでうざい')).toBe('うざい');
  });

  test('공백/기호로 우회해도 감지', () => {
    expect(findProfanity('し ね')).toBe('しね');
    expect(findProfanity('う・ざ・い')).toBe('うざい');
  });

  test('영어 욕설 감지 (대소문자 무관)', () => {
    expect(findProfanity('What the FUCK')).toBe('fuck');
  });
});

describe('findProfanityInAny', () => {
  test('여러 입력 중 하나라도 금칙어면 반환', () => {
    expect(findProfanityInAny('正常なタイトル', '本文にクソが入る')).toBe('クソ');
  });
  test('모두 깨끗하면 null', () => {
    expect(findProfanityInAny('タイトル', '本文', '')).toBeNull();
  });
});

describe('containsProfanity', () => {
  test('불리언 반환', () => {
    expect(containsProfanity('死ね')).toBe(true);
    expect(containsProfanity('こんにちは')).toBe(false);
  });
});
