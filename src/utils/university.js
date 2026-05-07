import { universities } from '../constants/universities';
import { universityLinks } from '../constants/universityLinks';

// 이메일 주소로 대학 정보 반환
// emailDomain 전체를 비교 (첫 세그먼트만 보면 st., stu. 등이 여러 학교에서 충돌)
// 일치하는 학교가 없으면 universities[0](국사관)을 기본값으로 반환
export function getUniversityInfo(email) {
  const domain = email?.split('@')?.[1] ?? '';
  return universities.find(u => u.emailDomain === domain) ?? universities[0];
}

// 대학 id로 URL 링크 정보 반환 (없으면 빈 객체)
export function getUniversityLinks(universityId) {
  return universityLinks[universityId] ?? {};
}
