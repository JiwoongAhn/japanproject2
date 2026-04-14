/**
 * SchoolPortalAuthPage — 학교 포털 로그인 화면
 * 대응 화면: src/screens/auth/SchoolPortalAuthScreen.js
 */
const { BasePage } = require('../BasePage');

class SchoolPortalAuthPage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 학적번호 입력 */
  async fillStudentId(studentId) {
    await this.page.getByPlaceholder('例: A1234567').fill(studentId);
  }

  /** 비밀번호 입력 */
  async fillPassword(password) {
    await this.page.getByPlaceholder('パスワードを入力').fill(password);
  }

  /** 로그인 버튼 클릭 */
  async submit() {
    await this.page.getByText('ログイン', { exact: true }).click();
  }

  /** 학적번호 + 비밀번호 입력 후 로그인까지 한번에 */
  async login(studentId, password) {
    await this.fillStudentId(studentId);
    await this.fillPassword(password);
    await this.submit();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 로그인 버튼 활성화 여부 반환 */
  async isLoginButtonEnabled() {
    const btn = this.page.getByText('ログイン');
    const disabled = await btn.evaluate((el) => el.closest('[disabled]') !== null || el.style.opacity === '0.4');
    return !disabled;
  }

  /**
   * Alert 다이얼로그의 메시지 텍스트를 캡처해서 반환
   * React Native Web은 Alert.alert()를 window.alert로 렌더링
   */
  async getAlertMessage() {
    return new Promise((resolve) => {
      this.page.once('dialog', async (dialog) => {
        const msg = dialog.message();
        await dialog.dismiss();
        resolve(msg);
      });
    });
  }
}

module.exports = { SchoolPortalAuthPage };
