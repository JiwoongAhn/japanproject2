/**
 * pushpriming.layout.spec.js — 통지 프리퍼미션(PushPrimingScreen) 넘침 검사 (5 뷰포트)
 *
 * 배경: SE3(375×667) 시뮬레이터에서 하단 고정 버튼이 3번째 카드(掲示板の返信) 본문을
 * 덮는 겹침이 발견됨(2026-09-18). 본문을 ScrollView 로 바꿔 수정했고, 재발 방지용으로 추가.
 *
 * 흐름:
 *  1) 환영·동의 플래그만 localStorage 에 넣고 push_priming_done_v1 은 비워 둔다
 *  2) 토큰 URL 로 로그인(닉네임 있는 테스트 유저) → 게이트가 pushPriming 을 띄운다
 *  3) probeOverflow 로 겹침·넘침·CTA 노출 판정
 *
 * 실행: npm run e2e:layout  (온보딩 스펙과 함께 돈다)
 */
const { test, expect } = require('@playwright/test');
const { getTestSession } = require('../helpers/supabaseHelper');
const { probeOverflow, formatViolations } = require('../helpers/overflowProbe');

const GATE_KEYS = ['welcome_seen_v1', 'unipas_privacy_consented_v2'];

test.describe('통지 프리퍼미션 레이아웃 — 넘침·겹침 없음', () => {
  test('하단 버튼이 카드를 덮지 않고, CTA 가 뷰포트 안에 있음', async ({ page }, testInfo) => {
    await page.addInitScript((keys) => {
      keys.forEach((k) => window.localStorage.setItem(k, '1'));
      window.localStorage.removeItem('push_priming_done_v1');
    }, GATE_KEYS);

    const session = await getTestSession();
    await page.goto(
      `/#access_token=${session.access_token}&refresh_token=${session.refresh_token}` +
      `&token_type=bearer&type=magiclink`
    );
    const cta = page.getByText('通知をオンにする', { exact: true });
    await cta.first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(300); // 레이아웃 정착

    const violations = await probeOverflow(page, { ctaTexts: ['通知をオンにする', 'あとで設定する'] });
    await page.screenshot({ path: testInfo.outputPath('push-priming.png') });

    expect(violations, `\n[${testInfo.project.name}] 넘침 위반:\n${formatViolations(violations)}\n`).toEqual([]);
  });
});
