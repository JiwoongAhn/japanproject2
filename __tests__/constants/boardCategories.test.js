// __tests__/constants/boardCategories.test.js
import { BOARD_CATEGORIES, getCategoryInfo } from '../../src/constants/boardCategories';

describe('getCategoryInfo', () => {
  // B-01: 'qa' 키 조회
  it('B-01: getCategoryInfo("qa") → key="qa", label="質問"인 객체 반환', () => {
    const result = getCategoryInfo('qa');
    expect(result.key).toBe('qa');
    expect(result.label).toBe('質問');
  });

  // B-02: 'free' 키 조회 (label은 '자유' → '自由'로 변경됨)
  it('B-02: getCategoryInfo("free") → key="free", label="自由"인 객체 반환', () => {
    const result = getCategoryInfo('free');
    expect(result.key).toBe('free');
    expect(result.label).toBe('自由');
  });

  // B-03: 'secret' 키 조회 (이전 flea 카테고리 → secret/info로 교체됨)
  it('B-03: getCategoryInfo("secret") → key="secret", label="秘密"인 객체 반환', () => {
    const result = getCategoryInfo('secret');
    expect(result.key).toBe('secret');
    expect(result.label).toBe('秘密');
  });

  // B-04: 존재하지 않는 키는 BOARD_CATEGORIES[0] 폴백
  it('B-04: getCategoryInfo("unknown") → BOARD_CATEGORIES[0] (key="qa") 반환', () => {
    const result = getCategoryInfo('unknown');
    expect(result).toEqual(BOARD_CATEGORIES[0]);
    expect(result.key).toBe('qa');
  });

  // B-05: 빈 문자열도 BOARD_CATEGORIES[0] 폴백
  it('B-05: getCategoryInfo("") → BOARD_CATEGORIES[0] (key="qa") 반환', () => {
    const result = getCategoryInfo('');
    expect(result).toEqual(BOARD_CATEGORIES[0]);
    expect(result.key).toBe('qa');
  });
});
