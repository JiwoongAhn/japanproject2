// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // 테스트 파일 위치
  testDir: './tests',

  // 각 테스트 파일은 독립적으로 실행
  fullyParallel: false,

  // CI 환경에서 실패 시 재시도 없음
  retries: 0,

  // 동시 실행 워커 수
  workers: 1,

  // 테스트 리포트 형식
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
  ],

  // 모든 테스트에 공통 적용되는 설정
  use: {
    // expo web 개발 서버 주소
    baseURL: 'http://localhost:8083',

    // 테스트 실패 시 스크린샷 자동 저장
    screenshot: 'only-on-failure',

    // 테스트 실패 시 비디오 저장
    video: 'retain-on-failure',

    // 액션 타임아웃 (버튼 클릭, 입력 등)
    actionTimeout: 10000,

    // 네비게이션 타임아웃 (페이지 이동)
    navigationTimeout: 15000,
  },

  // 테스트할 브라우저/디바이스 설정
  projects: [
    // ── 데스크탑 웹 (기본 개발 확인용) ──────────────────────────────
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── 모바일 뷰포트 시뮬레이션 (실기기 전 사전 확인용) ────────────
    // 주의: 이건 진짜 모바일 앱이 아닌 "브라우저에서 모바일 화면 크기"입니다.
    // 실제 모바일 E2E는 나중에 Maestro로 전환 예정.
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15'] },
    },
  ],

  // 테스트 시작 전 expo web 서버를 자동으로 띄우는 설정
  // (수동으로 `npx expo start --web --port 8083` 을 먼저 실행해도 됨)
  // webServer: {
  //   command: 'npx expo start --web --port 8083',
  //   url: 'http://localhost:8083',
  //   reuseExistingServer: true,
  //   timeout: 30000,
  // },
});
