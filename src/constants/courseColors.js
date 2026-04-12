// 과목별 파스텔 색상 팔레트 (10가지)
// bg: 셀 배경 (연한 파스텔), accent: 좌측 보더 & 텍스트 강조 (진한 색)
export const COURSE_COLORS = [
  { bg: '#EBF3FE', accent: '#3182F6' }, // Blue
  { bg: '#E8F8F0', accent: '#05C072' }, // Green
  { bg: '#FFF3E0', accent: '#FF8A00' }, // Orange
  { bg: '#FDE8E8', accent: '#F04438' }, // Red
  { bg: '#F3E8FD', accent: '#9B59B6' }, // Purple
  { bg: '#E8F4FD', accent: '#2196F3' }, // Sky
  { bg: '#FFF8E1', accent: '#F9A825' }, // Yellow
  { bg: '#E8FDF5', accent: '#00897B' }, // Teal
  { bg: '#FCE4EC', accent: '#E91E8C' }, // Pink
  { bg: '#E8EAF6', accent: '#3F51B5' }, // Indigo
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
