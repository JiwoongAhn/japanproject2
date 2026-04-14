// 날짜 관련 순수 함수
// 테스트 대상: date.test.js

// 오늘 날짜를 'YYYY-MM-DD' 문자열로 반환
export function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
