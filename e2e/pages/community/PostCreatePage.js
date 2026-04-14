/**
 * PostCreatePage — 게시글 작성 화면
 * 대응 화면: src/screens/community/PostCreateScreen.js
 */
const { BasePage } = require('../BasePage');

class PostCreatePage extends BasePage {
  // ── 액션 ─────────────────────────────────────────────────────────

  /** 제목 입력 */
  async fillTitle(title) {
    await this.page.getByPlaceholder('タイトルを入力してください').fill(title);
  }

  /** 본문 입력 */
  async fillBody(body) {
    await this.page.getByPlaceholder('本文を入力してください（任意）').fill(body);
  }

  /** 카테고리 선택 */
  async selectCategory(categoryLabel) {
    // categoryLabel: '質問' | 'フリー' | 'フリマ'
    await this.page.getByText(categoryLabel, { exact: true }).last().click();
  }

  /** 익명 토글 */
  async toggleAnonymous() {
    await this.page.getByText('匿名で投稿する').click();
  }

  /** 게시글 제출 (헤더 우측의 投稿 버튼 — exact: true로 "投稿"만 매칭) */
  async submit() {
    await this.page.getByText('投稿', { exact: true }).click();
  }

  /** 취소 */
  async cancel() {
    await this.page.getByText('キャンセル').last().click();
  }

  // ── 검증 ─────────────────────────────────────────────────────────

  /** 게시글 작성 화면이 표시되는지 확인 */
  async isVisible() {
    return await this.page.getByText('投稿する').isVisible();
  }
}

module.exports = { PostCreatePage };
