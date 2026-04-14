/**
 * PostListPage — 게시판 목록 화면
 * 대응 화면: src/screens/community/PostListScreen.js
 */
const { BasePage } = require('../BasePage');

class PostListPage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 게시글 작성 버튼 클릭 */
  async clickCreatePost() {
    await this.page.getByText('＋ 投稿する').click();
  }

  /** 카테고리 탭 클릭 */
  async selectCategory(categoryLabel) {
    // categoryLabel: '全体' | '質問' | 'フリー' | 'フリマ'
    // 게시판 화면의 카테고리 탭 선택
    await this.page.getByText(categoryLabel, { exact: true }).first().click();
  }

  /** 검색어 입력 */
  async search(keyword) {
    await this.page.getByPlaceholder('投稿を検索...').fill(keyword);
  }

  /** 특정 제목의 게시글 클릭 */
  async clickPost(title) {
    await this.page.getByText(title).click();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 게시판 화면이 표시되는지 확인 */
  async isVisible() {
    return await this.page.getByText('掲示板').first().isVisible();
  }

  /** 특정 제목의 게시글이 목록에 표시되는지 확인 */
  async hasPost(title) {
    return await this.page.getByText(title).isVisible();
  }

  /** 게시글 카드 목록 개수 반환 */
  async getPostCount() {
    return await this.page.locator('[cursor=pointer]').count();
  }
}

module.exports = { PostListPage };
