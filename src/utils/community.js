// 커뮤니티 관련 순수 함수
// 테스트 대상: community.test.js

// 타임스탬프로부터 경과 시간 표시 문자열 반환
// timestamp: ISO 문자열 또는 Date 객체
// 반환값: 'たった今' | 'N分前' | 'N時間前' | 'N日前'
export function formatTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1)   return 'たった今';
  if (diffMins < 60)  return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  return `${diffDays}日前`;
}
