/**
 * TimetablePage — 시간표 화면
 * 대응 화면: src/screens/timetable/TimetableScreen.js
 */
const { BasePage } = require('../BasePage');

class TimetablePage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 수업 추가 버튼 클릭 (시간표 헤더의 ＋ 追加) */
  async clickAddCourse() {
    // 시간표 탭의 ＋ 追加 (DOM 순서상 첫 번째)
    await this.page.getByText('＋ 追加').first().click();
  }

  /** 시간표 그리드에서 특정 셀(요일+교시) 클릭 */
  async clickCell(dayLabel, period) {
    // dayLabel: '月' | '火' | '水' | '木' | '金'
    // period: 1~8
    // 빈 셀은 ＋ 텍스트로 표시됨 — 특정 셀 클릭은 좌표 기반이 더 안정적
    // 현재는 헤더의 ＋ 追加 버튼으로 수업 추가
    await this.clickAddCourse();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 시간표에 등록된 수업 카드 목록 반환 */
  async getCourseCards() {
    // 그리드 내 수업 셀 (cursor=pointer 이고 ＋ 가 아닌 것)
    return await this.page.locator('[cursor=pointer]').all();
  }

  /** 특정 수업명이 그리드에 표시되는지 확인 */
  async hasCourse(courseName) {
    return await this.page.getByText(courseName).first().isVisible();
  }
}

module.exports = { TimetablePage };
