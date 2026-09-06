import { universities } from '../constants/universities';
import { universityLinks } from '../constants/universityLinks';

// 이메일 주소로 대학을 찾는다. 못 찾으면 null.
// emailDomain 전체를 비교 (첫 세그먼트만 보면 st., stu. 등이 여러 학교에서 충돌)
// ⚠️ 학교를 특정해야만 안전한 동작(학교 서버 접속 등)에는 반드시 이 함수를 쓸 것.
//    getUniversityInfo는 국사관으로 폴백하므로 "모르는 학교 = 국사관"이 되어 버린다.
export function findUniversityByEmail(email) {
  const domain = email?.split('@')?.[1] ?? '';
  return universities.find(u => u.emailDomain === domain) ?? null;
}

// 이메일 주소로 대학 정보 반환 (표시용)
// 일치하는 학교가 없으면 universities[0](국사관)을 기본값으로 반환 — 화면이 빈 값으로
// 깨지지 않게 하기 위한 폴백이며, 학교별 분기 판정에는 쓰면 안 된다.
export function getUniversityInfo(email) {
  const found = findUniversityByEmail(email);
  if (!found && __DEV__) {
    console.warn(
      `[university] 알 수 없는 이메일 도메인입니다: "${email?.split('@')?.[1] ?? ''}" → 국사관으로 폴백합니다.`
    );
  }
  return found ?? universities[0];
}

// 대학 id로 URL 링크 정보 반환 (없으면 빈 객체)
export function getUniversityLinks(universityId) {
  return universityLinks[universityId] ?? {};
}
