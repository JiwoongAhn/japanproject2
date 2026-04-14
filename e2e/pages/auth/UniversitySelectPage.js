/**
 * UniversitySelectPage — 학교 선택 화면 (로그인 첫 단계)
 * 대응 화면: src/screens/auth/UniversitySelectScreen.js
 */
const { BasePage } = require('../BasePage');

class UniversitySelectPage extends BasePage {
  // ── 화면 이동 ────────────────────────────────────────────────────

  async goto() {
    await this.navigate('/');
  }

  // ── 액션 ─────────────────────────────────────────────────────────

  /** 학교명으로 학교 카드 선택 */
  async selectUniversity(universityName) {
    await this.page.getByText(universityName).click();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 학교 선택 화면이 표시되는지 확인 */
  async isVisible() {
    return await this.page.getByText('大学を選んでください').isVisible();
  }
}

module.exports = { UniversitySelectPage };
