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

  /** 마감일 선택 — 인라인 달력에서 날짜 클릭 */
  async fillDueDate(dateStr) {
    // dateStr: 'YYYY-MM-DD' 형식
    const [targetYear, targetMonth, targetDay] = dateStr.split('-').map(Number);

    // 현재 표시 중인 연/월 파싱 (예: "2026年5月")
    const getDisplayedYM = async () => {
      const text = await this.page.locator('text=/\\d{4}年\\d+月/').first().textContent();
      const m = text.match(/(\d{4})年(\d+)月/);
      return { year: parseInt(m[1]), month: parseInt(m[2]) };
    };

    // 목표 월까지 이동 (최대 36개월)
    for (let i = 0; i < 36; i++) {
      const { year, month } = await getDisplayedYM();
      if (year === targetYear && month === targetMonth) break;
      const cur = year * 12 + month;
      const tgt = targetYear * 12 + targetMonth;
      if (cur < tgt) {
        await this.page.getByText('›').click();
      } else {
        await this.page.getByText('‹').click();
      }
      await this.page.waitForTimeout(150);
    }

    // 목표 날짜 셀 클릭 (exact: true — '5'가 '15'에 매칭되지 않도록)
    await this.page.getByText(String(targetDay), { exact: true }).first().click();
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
