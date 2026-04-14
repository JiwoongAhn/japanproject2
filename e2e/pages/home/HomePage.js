/**
 * HomePage — 홈 화면
 * 대응 화면: src/screens/HomeScreen.js
 *
 * 섹션:
 *  - 오늘의 수업 (今日の授業)
 *  - 마감 임박 과제 (締切が近い課題)
 *  - 게시판 미리보기 (掲示板)
 *  - 학교 정보 그리드 (学校情報)
 */
const { BasePage } = require('../BasePage');

class HomePage extends BasePage {
  // ── 검증 ─────────────────────────────────────────────────────────

  /** 홈 화면이 표시되는지 확인 */
  async isVisible() {
    return await this.page.getByText('今日の授業').first().isVisible();
  }

  /** 오늘 수업 섹션 헤더가 보이는지 */
  async hasTodayCourseSection() {
    return await this.page.getByText('今日の授業').first().isVisible();
  }

  /** 마감 임박 과제 섹션 헤더가 보이는지 */
  async hasUpcomingAssignmentSection() {
    return await this.page.getByText('締切が近い課題').first().isVisible();
  }

  /** 게시판 섹션 헤더가 보이는지 */
  async hasCommunitySection() {
    return await this.page.getByText('掲示板').first().isVisible();
  }

  /** 학교 정보 섹션 헤더가 보이는지 */
  async hasSchoolInfoSection() {
    return await this.page.getByText('学校情報').first().isVisible();
  }

  /** 오늘 수업 카드 목록 반환 */
  async getTodayCourseCards() {
    return await this.page.locator('[cursor=pointer]').all();
  }

  /** 마감 임박 과제 카드 목록 반환 */
  async getUpcomingAssignmentCards() {
    // 締切が近い課題 섹션 내 카드
    return [];
  }

  /** 게시글 미리보기 카드 목록 반환 */
  async getRecentPostCards() {
    return [];
  }

  // ── 액션 ─────────────────────────────────────────────────────────

  /** "すべて見る" 첫 번째 클릭 → 시간표 탭 이동 */
  async clickSeeAllCourses() {
    await this.page.getByText('すべて見る').first().click();
  }

  /** "すべて見る" 두 번째 클릭 → 과제 탭 이동 */
  async clickSeeAllAssignments() {
    await this.page.getByText('すべて見る').nth(1).click();
  }
}

module.exports = { HomePage };
