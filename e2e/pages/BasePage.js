/**
 * BasePage — 모든 Page Object가 상속하는 기반 클래스
 *
 * 역할:
 *  - Playwright의 page 객체를 보관
 *  - 하단 탭 이동처럼 모든 화면에서 공통으로 쓰는 동작 제공
 *
 * 나중에 모바일(Maestro 등)로 전환할 때:
 *  - 이 파일과 pages/ 하위 파일들만 교체하면 됨
 *  - tests/ 의 시나리오 흐름은 그대로 유지
 */
class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // ── 하단 탭 이동 ─────────────────────────────────────────────────

  async goToHomeTab() {
    await this.page.getByRole('tab', { name: /ホーム/ }).click();
    await this.waitForText('今日の授業');
  }

  async goToTimetableTab() {
    await this.page.getByRole('tab', { name: /時間割/ }).click();
    await this.waitForText('時間割');
  }

  async goToAssignmentTab() {
    await this.page.getByRole('tab', { name: /課題/ }).click();
    await this.waitForText('課題');
  }

  async goCommunityTab() {
    await this.page.getByRole('tab', { name: /掲示板/ }).click();
    await this.waitForText('掲示板');
  }

  // ── 공통 유틸 ────────────────────────────────────────────────────

  /** 특정 텍스트가 화면에 보일 때까지 대기 */
  async waitForText(text) {
    await this.page.getByText(text).first().waitFor({ state: 'visible' });
  }

  /** URL 이동 */
  async navigate(path = '/') {
    await this.page.goto(path);
  }
}

module.exports = { BasePage };
