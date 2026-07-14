// 과제 추가 폼 검증 (순수 함수)
//
// 무엇이 빠졌는지 구체적으로 돌려줘서, 저장 버튼을 눌렀을 때
// "왜 등록이 안 되는지" 사용자에게 알려줄 수 있게 한다.
// (예전엔 필수값이 하나라도 비면 버튼이 조용히 비활성화돼 반응이 없었음)
//
// 반환: { ok: true } 또는 { ok: false, field, message }
//   field   : 'courseName' | 'title' | 'dueDate' (어떤 칸이 문제인지)
//   message : 사용자에게 보여줄 일본어 안내

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateAssignmentForm({ courseName = '', title = '', dueDate = '' } = {}) {
  if (courseName.trim().length === 0) {
    return { ok: false, field: 'courseName', message: '科目名を入力してください' };
  }
  if (title.trim().length === 0) {
    return { ok: false, field: 'title', message: '課題タイトルを入力してください' };
  }
  if (!DATE_RE.test(dueDate)) {
    return { ok: false, field: 'dueDate', message: 'カレンダーから提出期限を選んでください' };
  }
  return { ok: true };
}
