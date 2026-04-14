// 과제 관련 순수 함수
// 테스트 대상: assignment.test.js

import { colors } from '../constants/colors';

// D-day 계산
// dueDateStr: 'YYYY-MM-DD' 형식의 마감일 문자열
// 반환값: { label: 'D-3', isUrgent: true/false }
export function calcDday(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diff < 0)   return { label: `D+${Math.abs(diff)}`, isUrgent: true };
  if (diff === 0) return { label: 'D-Day',               isUrgent: true };
  if (diff <= 3)  return { label: `D-${diff}`,           isUrgent: true };
  return                 { label: `D-${diff}`,           isUrgent: false };
}

// D-day 숫자에 따른 색상 반환
// dday: 남은 일수 (음수 = 기한 초과)
export function getDdayColor(dday) {
  if (dday <= 1) return colors.warning;
  if (dday <= 3) return colors.primary;
  return colors.textSecondary;
}

// 마감일 입력 시 자동 하이픈 포맷
// text: 사용자가 입력한 문자열 (숫자 외 문자 포함 가능)
// 반환값: 'YYYY-MM-DD' 형식 문자열
export function formatDueDate(text) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length >= 7) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  if (digits.length >= 5) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return digits;
}

// 과제 추가 폼 유효성 검사
// courseName: 수업명, title: 과제 제목, dueDate: 마감일 문자열
// 반환값: true (유효) | false (무효)
export function isAssignmentFormValid(courseName, title, dueDate) {
  return (
    courseName.trim().length > 0 &&
    title.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())
  );
}
