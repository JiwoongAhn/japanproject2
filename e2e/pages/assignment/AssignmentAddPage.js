/**
 * AssignmentAddPage — 과제 추가 화면
 * 대응 화면: src/screens/assignment/AssignmentAddScreen.js
 */
const { BasePage } = require('../BasePage');

class AssignmentAddPage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 과목명 입력 */
  async fillCourseName(name) {
    await this.page.getByPlaceholder('例: 経営学概論').last().fill(name);
  }

  /** 과제 제목 입력 */
  async fillTitle(title) {
    await this.page.getByPlaceholder('例: 第3章 レポート提出').fill(title);
  }

  /** 마감일 입력 (숫자만 입력하면 자동 하이픈 삽입됨) */
  async fillDueDate(date) {
    // date: '2027-12-31' 형식으로 입력
    await this.page.getByPlaceholder('例: 2026-04-15').fill(date);
  }

  /** 저장 버튼 클릭 */
  async submit() {
    await this.page.getByText('保存する').last().click();
  }

  /** 취소 버튼 클릭 */
  async cancel() {
    await this.page.getByText('キャンセル').click();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 과제 추가 화면이 표시되는지 확인 */
  async isVisible() {
    return await this.page.getByText('課題を追加').isVisible();
  }

  /** 저장 버튼 활성화 여부 (필수항목 미입력 시 disabled) */
  async isSubmitEnabled() {
    const btn = this.page.getByText('保存する').last();
    const isDisabled = await btn.evaluate((el) => {
      const touchable = el.closest('[aria-disabled="true"]') || el.closest('[disabled]');
      return touchable !== null;
    });
    return !isDisabled;
  }
}

module.exports = { AssignmentAddPage };
