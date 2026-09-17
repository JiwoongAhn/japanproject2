import {
  computeMockSize,
  shouldShowMockup,
  MOCK_ASPECT,
  MOCK_WIDTH_MAX,
  MOCK_WIDTH_MIN,
  ONBOARDING_FIXED_HEIGHT,
} from '../../src/utils/layout';

// 온보딩 화면에서 목업이 아닌 고정 요소들의 세로 합(OnboardingScreen 스타일 기준).
// 상단바 56 + mockArea paddingTop 16 + 제목 2줄 76+8 + 부제 2줄 44+20
// + 하단(패딩 8 + 점 6 + 여백 20 + 버튼 56 + 패딩 24) 114 = 334
const FIXED = ONBOARDING_FIXED_HEIGHT;

// 기기 6종: [이름, 창 폭, 창 높이, 상단 세이프에어리어, 하단 세이프에어리어]
const DEVICES = [
  ['iPhone SE 3세대', 375, 667, 20, 0],
  ['iPhone 12', 390, 844, 47, 34],
  ['iPhone 13 mini', 375, 812, 50, 34],
  ['iPhone 16 Pro Max', 440, 956, 59, 34],
  ['Pixel 7', 412, 915, 24, 0],
  ['구형 안드로이드(320×568)', 320, 568, 24, 0],
];

const availOf = (h, top, bottom) => h - top - bottom - FIXED;

describe('computeMockSize — 기기별 "필요 높이 ≤ 가용 높이"', () => {
  test.each(DEVICES)('%s', (_name, w, h, top, bottom) => {
    const availH = availOf(h, top, bottom);
    const availW = w - 40; // paddingHorizontal xl(20) × 2
    const size = computeMockSize(availH, availW);
    // 핵심 불변식: 계산된 목업은 절대 가용 공간을 넘지 않는다
    expect(size.height).toBeLessThanOrEqual(availH);
    expect(size.width).toBeLessThanOrEqual(availW);
    expect(size.width).toBeLessThanOrEqual(MOCK_WIDTH_MAX);
  });

  test('큰 화면(16 Pro Max)은 상한 240에 걸려 기존과 동일하게 렌더', () => {
    const size = computeMockSize(availOf(956, 59, 34), 400);
    expect(size).toEqual({ width: 240, height: 492, visible: true });
  });

  test('iPhone 12는 예전 492px가 가용 높이를 넘겼고, 이제는 안 넘긴다', () => {
    const availH = availOf(844, 47, 34); // 429
    expect(492).toBeGreaterThan(availH); // 버그 재현: 예전 고정 높이는 넘쳤다
    const size = computeMockSize(availH, 350);
    expect(size.height).toBeLessThanOrEqual(availH);
    expect(size.visible).toBe(true);
  });

  test('iPhone SE는 목업이 줄어들되 최소 폭 이상이라 계속 보인다', () => {
    const availH = availOf(667, 20, 0); // 313
    const size = computeMockSize(availH, 335);
    expect(size.height).toBeLessThanOrEqual(availH);
    expect(size.width).toBeGreaterThanOrEqual(MOCK_WIDTH_MIN);
    expect(size.visible).toBe(true);
  });

  test('구형 320×568은 공간이 부족해 목업을 숨긴다(visible=false)', () => {
    const size = computeMockSize(availOf(568, 24, 0), 280);
    expect(size.visible).toBe(false);
    expect(size.height).toBeLessThanOrEqual(availOf(568, 24, 0));
  });

  test('세로 비율은 항상 MOCK_ASPECT를 유지한다', () => {
    const size = computeMockSize(400, 400);
    expect(size.height).toBe(Math.round(size.width * MOCK_ASPECT));
  });

  test('가로 공간이 더 좁으면 가로에 맞춘다', () => {
    const size = computeMockSize(1000, 150);
    expect(size.width).toBe(150);
  });

  test('가용 공간이 0·음수·NaN이면 0 크기 + 숨김 (크래시 없음)', () => {
    expect(computeMockSize(0, 300)).toEqual({ width: 0, height: 0, visible: false });
    expect(computeMockSize(-50, 300)).toEqual({ width: 0, height: 0, visible: false });
    expect(computeMockSize(NaN, 300)).toEqual({ width: 0, height: 0, visible: false });
    expect(computeMockSize(undefined, undefined)).toEqual({ width: 0, height: 0, visible: false });
  });

  test('가로 공간 생략(undefined) 시 세로만으로 계산', () => {
    const size = computeMockSize(492);
    expect(size.width).toBe(240);
  });
});

describe('shouldShowMockup — 창 높이만으로 사전 판정', () => {
  test('iPhone SE(667)·12(844)·Pixel 7(915)은 보임', () => {
    expect(shouldShowMockup(667)).toBe(true);
    expect(shouldShowMockup(844)).toBe(true);
    expect(shouldShowMockup(915)).toBe(true);
  });
  test('구형 320×568은 숨김', () => {
    expect(shouldShowMockup(568)).toBe(false);
  });
  test('잘못된 입력은 false', () => {
    expect(shouldShowMockup(0)).toBe(false);
    expect(shouldShowMockup(NaN)).toBe(false);
    expect(shouldShowMockup(undefined)).toBe(false);
  });
});
