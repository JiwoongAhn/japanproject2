/**
 * PostDetailPage — 게시글 상세 화면
 * 대응 화면: src/screens/community/PostDetailScreen.js
 */
const { BasePage } = require('../BasePage');

class PostDetailPage extends BasePage {
  // ── 검증 ─────────────────────────────────────────────────────────

  /** 게시글 제목 텍스트 반환 */
  async getTitle() {
    // TODO: 실제 선택자로 교체 필요
    return '';
  }

  /** 댓글 목록 반환 */
  async getComments() {
    // TODO: 실제 선택자로 교체 필요
    return [];
  }

  // ── 액션 ─────────────────────────────────────────────────────────

  /** 댓글 입력 후 등록 */
  async submitComment(text) {
    // TODO: 실제 선택자로 교체 필요
  }

  /** 좋아요 버튼 클릭 */
  async clickLike() {
    // TODO: 실제 선택자로 교체 필요
  }
}

module.exports = { PostDetailPage };
