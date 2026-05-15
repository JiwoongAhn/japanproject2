// 과목별 파스텔 색상 팔레트 (밀러의 법칙 — 7±2)
// 일본 감성 파스텔 7색. bg: 셀 배경, accent: 텍스트·강조 색
// 디자인 토큰 `colors.pastel`과 동기화 (src/constants/colors.js)
import { pastel } from './colors';

export const COURSE_COLORS = [
  pastel.sky,       // 하늘
  pastel.mint,      // 민트
  pastel.peach,     // 피치
  pastel.lavender,  // 라벤더
  pastel.yellow,    // 옐로
  pastel.pink,      // 핑크
  pastel.rose,      // 로즈
];

// course.id(UUID)를 기반으로 색상을 자동 배정
// UUID에서 숫자(0-9)만 추출해 합산 후 10으로 나눈 나머지로 색상 인덱스 결정
export function getCourseColor(courseId) {
  if (!courseId) return COURSE_COLORS[0];
  const digits = courseId.replace(/-/g, '').replace(/[a-f]/gi, '');
  if (!digits) return COURSE_COLORS[0];
  const sum = digits.split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  return COURSE_COLORS[sum % COURSE_COLORS.length];
}
