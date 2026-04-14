// 강의평가 태그 관련 순수 함수
// 테스트 대상: review.test.js

// 태그 토글: 이미 있으면 제거, 없으면 추가
// tag: 토글할 태그 문자열
// selectedTags: 현재 선택된 태그 배열
// 반환값: 새 태그 배열
export function toggleTag(tag, selectedTags) {
  return selectedTags.includes(tag)
    ? selectedTags.filter(t => t !== tag)
    : [...selectedTags, tag];
}

// 직접 입력 태그 추가
// tag: 추가할 태그 문자열 (앞뒤 공백 자동 제거)
// selectedTags: 현재 선택된 태그 배열
// 반환값: 새 태그 배열 (조건 미충족 시 원본 배열 그대로 반환)
export function addCustomTag(tag, selectedTags) {
  const trimmed = tag.trim();
  if (!trimmed || selectedTags.includes(trimmed) || selectedTags.length >= 8) {
    return selectedTags;
  }
  return [...selectedTags, trimmed];
}
