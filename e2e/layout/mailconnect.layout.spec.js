/**
 * mailconnect.layout.spec.js — manaba 연결 온보딩(MailConnectOnboardingScreen) 넘침 검사
 *
 * OnboardingScreen 과 같은 PhoneMockup 고정 높이 버그가 복제돼 있던 화면.
 * 로그인 → 웹 URL(/MailConnectOnboarding)로 모달 직접 진입 → 슬라이드 3장 판정.
 * (React Navigation 웹은 linking config 가 없으면 화면 이름을 그대로 경로로 쓴다)
 *
 * 실행: npm run e2e:layout
 */
const { test, expect } = require('@playwright/test');
const { getTestSession, updateTestProfile } = require('../helpers/supabaseHelper');
const { probeOverflow, formatViolations } = require('../helpers/overflowProbe');

const GATE_KEYS = ['welcome_seen_v1', 'unipas_privacy_consented_v2', 'push_priming_done_v1'];

test.describe('manaba 연결 온보딩 레이아웃 — 넘침 없음', () => {
  test.beforeAll(async () => {
    // 홈으로 바로 들어가야 하므로 온보딩은 완료 상태로
    await updateTestProfile({ onboarding_completed: true });
  });

  test('슬라이드 3장 전부 넘침 없음', async ({ page }, testInfo) => {
    await page.addInitScript((keys) => {
      keys.forEach((k) => window.localStorage.setItem(k, '1'));
    }, GATE_KEYS);

    const session = await getTestSession();
    await page.goto(
      `/#access_token=${session.access_token}&refresh_token=${session.refresh_token}` +
      `&token_type=bearer&type=magiclink`
    );
    // 홈(하단 탭) 도달 확인 후 모달 화면으로 이동
    await page.getByText('マイページ', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.goto('/MailConnectOnboarding');
    await page.getByText('次へ', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });

    const report = [];
    const totalPages = 3;
    for (let i = 0; i < totalPages; i++) {
      await page.evaluate((pageIdx) => {
        const pager = Array.from(document.querySelectorAll('*')).find((el) => {
          const cs = getComputedStyle(el);
          return ['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 10;
        });
        if (!pager) throw new Error('가로 페이저(ScrollView)를 찾지 못함');
        pager.scrollLeft = pageIdx * pager.clientWidth;
      }, i);
      await page.waitForTimeout(300);
      const violations = await probeOverflow(page, { ctaTexts: ['次へ'] });
      await page.screenshot({ path: testInfo.outputPath(`slide-${i + 1}.png`) });
      if (violations.length) report.push(`--- 슬라이드 ${i + 1} ---\n${formatViolations(violations)}`);
    }

    expect(report, `\n[${testInfo.project.name}] 넘침 위반:\n${report.join('\n')}\n`).toEqual([]);
  });
});
