import { toggleTag, addCustomTag } from '../../src/utils/review';

describe('toggleTag', () => {
  // R-01: 빈 배열에 태그 추가
  it('R-01: 빈 배열에 태그를 추가하면 해당 태그만 포함된 배열을 반환한다', () => {
    expect(toggleTag('わかりやすい', [])).toEqual(['わかりやすい']);
  });

  // R-02: 이미 있는 태그 → 제거
  it('R-02: 이미 선택된 태그를 토글하면 배열에서 제거한다', () => {
    expect(toggleTag('わかりやすい', ['わかりやすい'])).toEqual([]);
  });

  // R-03: 없는 태그 → 기존 배열 뒤에 추가
  it('R-03: 선택되지 않은 태그를 토글하면 기존 태그 뒤에 추가한다', () => {
    expect(toggleTag('おすすめ', ['わかりやすい'])).toEqual(['わかりやすい', 'おすすめ']);
  });
});

describe('addCustomTag', () => {
  // R-04: 정상 태그 추가
  it('R-04: 유효한 태그를 추가하면 배열에 포함된다', () => {
    expect(addCustomTag('自由記述', [])).toEqual(['自由記述']);
  });

  // R-05: 빈 문자열 → 추가 안 됨
  it('R-05: 빈 문자열은 추가하지 않고 원본 배열을 반환한다', () => {
    expect(addCustomTag('', [])).toEqual([]);
  });

  // R-06: 공백만 있는 문자열 → 추가 안 됨
  it('R-06: 공백만 있는 문자열은 추가하지 않고 원본 배열을 반환한다', () => {
    expect(addCustomTag('   ', [])).toEqual([]);
  });

  // R-07: 중복 태그 → 추가 안 됨
  it('R-07: 이미 존재하는 태그는 중복 추가하지 않는다', () => {
    expect(addCustomTag('わかりやすい', ['わかりやすい'])).toEqual(['わかりやすい']);
  });

  // R-08: 8개 태그 초과 → 추가 안 됨
  it('R-08: 태그가 이미 8개이면 새 태그를 추가하지 않는다', () => {
    const eightTags = ['タグ1', 'タグ2', 'タグ3', 'タグ4', 'タグ5', 'タグ6', 'タグ7', 'タグ8'];
    const result = addCustomTag('新しいタグ', eightTags);
    expect(result).toHaveLength(8);
    expect(result).toEqual(eightTags);
  });
});
