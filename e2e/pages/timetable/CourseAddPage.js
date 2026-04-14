/**
 * CourseAddPage — 수업 추가 화면
 * 대응 화면: src/screens/timetable/CourseAddScreen.js
 */
const { BasePage } = require('../BasePage');

class CourseAddPage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 과목명 입력 */
  async fillCourseName(name) {
    await this.page.getByPlaceholder('例: 経営学概論').fill(name);
  }

  /** 요일 선택 — CourseAdd 폼 안의 요일 버튼 (시간표 그리드 헤더 후에 위치) */
  async selectDay(dayLabel) {
    // dayLabel: '月' | '火' | '水' | '木' | '金'
    // 시간표 그리드의 요일 헤더와 겹치므로 last()로 CourseAdd 폼의 버튼 클릭
    await this.page.getByText(dayLabel, { exact: true }).last().click();
  }

  /** 교시 선택 */
  async selectPeriod(period) {
    // period: 1~8 → 화면에 "1限" ~ "8限" 으로 표시
    await this.page.getByText(`${period}限`).click();
  }

  /** 담당교원 이름 입력 (선택사항) */
  async fillRoom(room) {
    await this.page.getByPlaceholder('例: 田中 一郎').fill(room);
  }

  /** 저장 버튼 클릭 */
  async submit() {
    await this.page.getByText('保存する').click();
  }

  /** 취소 버튼 클릭 */
  async cancel() {
    await this.page.getByText('キャンセル').click();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 수업 추가 화면이 표시되는지 확인 */
  async isVisible() {
    return await this.page.getByText('授業を追加').isVisible();
  }

  /** 저장 버튼 활성화 여부 (필수항목 미입력 시 opacity 0.5) */
  async isSubmitEnabled() {
    const btn = this.page.getByText('保存する');
    const opacity = await btn.evaluate((el) => {
      const parent = el.closest('[disabled]');
      return parent ? false : true;
    });
    return opacity;
  }
}

module.exports = { CourseAddPage };
