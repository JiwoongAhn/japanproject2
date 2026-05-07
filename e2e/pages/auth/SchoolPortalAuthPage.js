/**
 * SchoolPortalAuthPage — 학교 포털 로그인 화면
 * 대응 화면: src/screens/auth/SchoolPortalAuthScreen.js
 *
 * 현재 인증 방식: 학교 이메일 입력 → "認証コードを送信" 버튼 → OTP 화면
 */
const { BasePage } = require('../BasePage');

class SchoolPortalAuthPage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 학교 이메일 입력 (예: A1234567@kokushikan.ac.jp) */
  async fillEmail(email) {
    await this.page.getByPlaceholder(/学籍番号@/).fill(email);
    // Safari: fill 후 React state 업데이트를 위해 다음 렌더링 프레임까지 대기
    await this.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  }

  /** OTP 전송 버튼 클릭 */
  async submitSendOtp() {
    await this.page.getByText('認証コードを送信', { exact: true }).click();
  }

  /** 이메일 입력 + OTP 전송까지 한번에 */
  async sendOtp(email) {
    await this.fillEmail(email);
    await this.submitSendOtp();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /**
   * OTP 전송 버튼 활성화 여부 반환
   * React Native Web: disabled 시 부모 요소에 opacity 0.4 적용
   */
  async isSendButtonEnabled() {
    const opacity = await this.page
      .getByText('認証コードを送信', { exact: true })
      .evaluate((el) => {
        let cur = el;
        while (cur && cur !== document.body) {
          const op = parseFloat(window.getComputedStyle(cur).opacity);
          if (!isNaN(op) && op < 0.9) return op;
          cur = cur.parentElement;
        }
        return 1.0;
      });
    return opacity >= 0.9;
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
