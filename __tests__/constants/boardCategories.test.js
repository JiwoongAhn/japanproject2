// __tests__/constants/boardCategories.test.js
import { BOARD_CATEGORIES, getCategoryInfo } from '../../src/constants/boardCategories';

describe('getCategoryInfo', () => {
  // B-01: 'qa' 키 조회
  it('B-01: getCategoryInfo("qa") → key="qa", label="質問"인 객체 반환', () => {
    const result = getCategoryInfo('qa');
    expect(result.key).toBe('qa');
    expect(result.label).toBe('質問');
  });

  // B-02: 'free' 키 조회
  it('B-02: getCategoryInfo("free") → key="free", label="フリー"인 객체 반환', () => {
    const result = getCategoryInfo('free');
    expect(result.key).toBe('free');
    expect(result.label).toBe('フリー');
  });

  // B-03: 'flea' 키 조회
  it('B-03: getCategoryInfo("flea") → key="flea", label="フリマ"인 객체 반환', () => {
    const result = getCategoryInfo('flea');
    expect(result.key).toBe('flea');
    expect(result.label).toBe('フリマ');
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
