// @ts-check
// 레이아웃 넘침 검사 전용 Playwright 설정 (기존 e2e/playwright.config.js 는 건드리지 않음)
//
// - 뷰포트를 devices[...] 프리셋이 아니라 명시 viewport 로 준다.
//   이유: OnboardingScreen 이 모듈 로드 시점에 Dimensions.get('window') 을 캡처하므로
//   뷰포트는 page.goto 전에 확정돼 있어야 한다.
// - 여기서만 expo web 서버 자동 기동(webServer)을 켠다. 이미 떠 있으면 재사용.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { defineConfig } = require('@playwright/test');

// 검사 뷰포트 5종 (CSS px 기준, 모바일 브라우저 상단바 제외 근사치)
const VIEWPORTS = [
  { name: 'iPhone-SE3',      viewport: { width: 375, height: 667 } },
  { name: 'iPhone-13mini',   viewport: { width: 375, height: 812 } },
  { name: 'iPhone-12',       viewport: { width: 390, height: 844 } },
  { name: 'Pixel-7',         viewport: { width: 412, height: 915 } },
  { name: 'Android-old-320', viewport: { width: 320, height: 568 } },
];

module.exports = defineConfig({
  testDir: './layout',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8083',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 20000,
    isMobile: true,
    hasTouch: true,
  },
  projects: VIEWPORTS.map(({ name, viewport }) => ({
    name,
    use: { viewport, deviceScaleFactor: 2 },
  })),
  webServer: {
    command: 'npx expo start --web --port 8083',
    cwd: require('path').resolve(__dirname, '..'), // 이 설정 파일은 e2e/ 에 있으므로 프로젝트 루트로
    url: 'http://localhost:8083',
    reuseExistingServer: true,
    timeout: 90000,
  },
});
