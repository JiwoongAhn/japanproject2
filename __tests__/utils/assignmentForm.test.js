import { validateAssignmentForm } from '../../src/utils/assignmentForm';

describe('validateAssignmentForm', () => {
  const valid = { courseName: '経営学概論', title: '第3章 レポート', dueDate: '2026-07-20' };

  test('모든 값이 채워지면 ok', () => {
    expect(validateAssignmentForm(valid)).toEqual({ ok: true });
  });

  test('과목명이 비면 courseName 안내', () => {
    const r = validateAssignmentForm({ ...valid, courseName: '   ' });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('courseName');
    expect(r.message).toBeTruthy();
  });

  test('제목이 비면 title 안내', () => {
    const r = validateAssignmentForm({ ...valid, title: '' });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('title');
  });

  test('날짜 미선택이면 dueDate 안내', () => {
    const r = validateAssignmentForm({ ...valid, dueDate: '' });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('dueDate');
  });

  test('날짜 형식이 틀리면 dueDate 안내', () => {
    expect(validateAssignmentForm({ ...valid, dueDate: '2026/07/20' }).field).toBe('dueDate');
    expect(validateAssignmentForm({ ...valid, dueDate: '2026-7-2' }).field).toBe('dueDate');
  });

  test('검증 우선순위: 과목명 → 제목 → 날짜 (여러 개 비어도 첫 번째부터)', () => {
    expect(validateAssignmentForm({ courseName: '', title: '', dueDate: '' }).field).toBe('courseName');
    expect(validateAssignmentForm({ courseName: 'A', title: '', dueDate: '' }).field).toBe('title');
    expect(validateAssignmentForm({ courseName: 'A', title: 'B', dueDate: '' }).field).toBe('dueDate');
  });

  test('인자 없이 호출해도 안전 (courseName 안내)', () => {
    expect(validateAssignmentForm().field).toBe('courseName');
  });
});
