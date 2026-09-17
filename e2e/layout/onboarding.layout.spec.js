/**
 * onboarding.layout.spec.js — 온보딩 화면 넘침 검사 (5 뷰포트 × 슬라이드 전부)
 *
 * 흐름:
 *  1) 테스트 유저의 onboarding_completed 를 false 로 되돌린다 (온보딩 게이트 진입 조건)
 *  2) 로그인 이전 1회 게이트(환영·동의·통지 프리퍼미션) 플래그를 localStorage 에 미리 넣는다
 *  3) 토큰 URL 로 로그인 → AppNavigator 가 곧바로 온보딩 화면을 띄운다
 *  4) 슬라이드를 한 장씩 넘기며 매 장 probeOverflow 로 판정
 *
 * ⚠️ 웹 한계: react-native-web 의 ScrollView 는 onMomentumScrollEnd 를 발생시키지 않아
 *    "次へ" 버튼으로는 index 상태가 안 바뀐다(네이티브에선 정상). 그래서 가로 스크롤
 *    컨테이너의 scrollLeft 를 직접 옮겨 슬라이드를 넘긴다. 그 결과 요약 페이지의 CTA 는
 *    "次へ" 상태로 측정된다(진짜 요약 CTA 2개는 시뮬레이터 스크린샷에서 눈으로 확인).
 *
 * 실행: npm run e2e:layout
 */
const { test, expect } = require('@playwright/test');
const { getTestSession, updateTestProfile } = require('../helpers/supabaseHelper');
const { probeOverflow, formatViolations } = require('../helpers/overflowProbe');

// AppNavigator 의 로그인 이전 게이트 키 (WelcomeScreen / PrivacyConsentScreen / PushPrimingScreen)
const GATE_KEYS = ['welcome_seen_v1', 'unipas_privacy_consented_v2', 'push_priming_done_v1'];

test.describe('온보딩 레이아웃 — 넘침 없음', () => {
  test.beforeAll(async () => {
    await updateTestProfile({ onboarding_completed: false });
  });
  test.afterAll(async () => {
    // 다른 e2e 는 홈 화면에서 시작하므로 원상복구
    await updateTestProfile({ onboarding_completed: true });
  });

  test('슬라이드 6장 + 요약 페이지 전부 넘침 없음', async ({ page }, testInfo) => {
    // 2) 게이트 플래그 사전 주입 (AsyncStorage web = localStorage)
    await page.addInitScript((keys) => {
      keys.forEach((k) => window.localStorage.setItem(k, '1'));
    }, GATE_KEYS);

    // 3) 토큰 로그인 → 온보딩 첫 장
    const session = await getTestSession();
    await page.goto(
      `/#access_token=${session.access_token}&refresh_token=${session.refresh_token}` +
      `&token_type=bearer&type=magiclink`
    );
    const next = page.getByText('次へ', { exact: true });
    await next.first().waitFor({ state: 'visible', timeout: 30000 });

    // 4) 매 장 판정 — 가로 페이저를 직접 스크롤해서 넘긴다 (위 ⚠️ 참고)
    const report = [];
    const totalPages = 7; // SLIDES 6장 + 요약 1장
    for (let i = 0; i < totalPages; i++) {
      await page.evaluate((pageIdx) => {
        const pager = Array.from(document.querySelectorAll('*')).find((el) => {
          const cs = getComputedStyle(el);
          return ['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 10;
        });
        if (!pager) throw new Error('가로 페이저(ScrollView)를 찾지 못함');
        pager.scrollLeft = pageIdx * pager.clientWidth;
      }, i);
      await page.waitForTimeout(300); // 레이아웃 정착
      const violations = await probeOverflow(page, { ctaTexts: ['次へ'] });
      await page.screenshot({ path: testInfo.outputPath(`slide-${i + 1}.png`) });
      if (violations.length) report.push(`--- 슬라이드 ${i + 1} ---\n${formatViolations(violations)}`);
    }

    expect(report, `\n[${testInfo.project.name}] 넘침 위반:\n${report.join('\n')}\n`).toEqual([]);
  });
});
