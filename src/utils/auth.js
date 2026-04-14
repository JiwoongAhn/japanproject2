// 인증 관련 순수 함수
// 테스트 대상: auth.test.js

// 학적번호 + 대학 ID → Supabase 로그인용 이메일 생성
// studentId: 학적번호 문자열 (앞뒤 공백 자동 제거)
// universityId: 대학 ID 문자열 (null/undefined 시 'kokushikan' 기본값)
// 반환값: '{studentId}@{universityId}.unipas'
export function buildEmail(studentId, universityId) {
  const id = studentId.trim();
  return `${id}@${universityId ?? 'kokushikan'}.unipas`;
}
