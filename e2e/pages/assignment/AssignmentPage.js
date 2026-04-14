/**
 * AssignmentPage — 과제 목록 화면
 * 대응 화면: src/screens/AssignmentScreen.js
 */
const { BasePage } = require('../BasePage');

class AssignmentPage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 과제 추가 버튼 클릭 (課題 탭 헤더의 ＋ 追加) */
  async clickAddAssignment() {
    // 課題 탭이 active일 때 가시적인 유일한 ＋ 追加 버튼
    // (React Navigation이 비활성 탭을 CSS로 숨겨서 .first()로 충분)
    await this.page.getByText('＋ 追加').first().click();
  }

  /** 특정 과제 카드의 상태 배지 클릭 (상태 토글) */
  async toggleAssignmentStatus(title) {
    // 과제 제목 텍스트를 찾아 같은 카드 내의 상태 배지 클릭
    const card = this.page.locator(`:text("${title}")`).locator('..');
    await card.getByText(/未提出|提出済|期限超過/).click();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 과제 탭 화면이 표시되는지 확인 */
  async isVisible() {
    return await this.page.getByRole('tab', { name: /課題/ }).isVisible();
  }

  /** 과제 카드 목록 반환 */
  async getAssignmentCards() {
    return await this.page.locator('[cursor=pointer]').all();
  }

  /** 특정 제목의 과제 상태 텍스트 반환 ('未提出' | '提出済' | '期限超過') */
  async getAssignmentStatus(title) {
    const card = this.page.locator(`:text("${title}")`).locator('..');
    const statusEl = card.getByText(/未提出|提出済|期限超過/).first();
    return await statusEl.textContent();
  }
}

module.exports = { AssignmentPage };
