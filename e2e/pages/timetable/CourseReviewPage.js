/**
 * CourseReviewPage — 강의평가 화면 (목록 + 작성)
 * 대응 화면: src/screens/timetable/CourseReviewScreen.js
 *            src/screens/timetable/CourseReviewCreateScreen.js
 */
const { BasePage } = require('../BasePage');

class CourseReviewPage extends BasePage {
  // ── 액션 (작성) ──────────────────────────────────────────────────

  async clickWriteReview() {
    // TODO: 실제 선택자로 교체 필요
  }

  async fillCourseName(name) {
    // TODO: 실제 선택자로 교체 필요
  }

  async selectRating(stars) {
    // stars: 1~5
    // TODO: 실제 선택자로 교체 필요
  }

  async toggleTag(tagLabel) {
    // TODO: 실제 선택자로 교체 필요
  }

  async fillComment(comment) {
    // TODO: 실제 선택자로 교체 필요
  }

  async submitReview() {
    // TODO: 실제 선택자로 교체 필요
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 강의평가 카드 목록 반환 */
  async getReviewCards() {
    // TODO: 실제 선택자로 교체 필요
    return [];
  }
}

module.exports = { CourseReviewPage };
