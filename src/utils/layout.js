// 온보딩 폰 목업 크기 계산 (순수 함수)
//
// 문제: PhoneMockup은 폭 240 × 비율 2.05 = 높이 492px로 고정돼 있었다.
//       iPhone SE(667px) 같은 작은 화면은 목업을 둘 공간이 ~313px뿐이라
//       180px가 넘치고, 넘친 만큼 제목·버튼을 덮었다.
// 해결: "남는 공간에서 역산" — 목업 크기를 원인이 아니라 결과로 만든다.
//       큰 화면은 상한(MOCK_WIDTH_MAX)에 걸려 예전과 픽셀 단위로 동일 → 회귀 0.

export const MOCK_ASPECT = 2.05;    // 세로/가로 비율 (기존 PhoneMockup 값 유지)
export const MOCK_WIDTH_MAX = 240;  // 기존 기본 폭 = 큰 화면에서는 현행과 동일
export const MOCK_WIDTH_MIN = 132;  // 이보다 작아지면 목업이 무의미 → 숨김

/**
 * 가용 영역에 들어가는 목업 크기를 계산한다.
 * @param {number} availH 목업을 놓을 수 있는 세로 공간(px)
 * @param {number} availW 목업을 놓을 수 있는 가로 공간(px). 생략 시 제한 없음
 * @returns {{ width:number, height:number, visible:boolean }}
 *   - width/height: 목업 프레임 크기(px). 공간이 없으면 0
 *   - visible: MOCK_WIDTH_MIN 이상이라 그릴 가치가 있는가
 */
export function computeMockSize(availH, availW) {
  const h = Number.isFinite(availH) && availH > 0 ? availH : 0;
  const w = Number.isFinite(availW) && availW > 0 ? availW : Infinity;
  const width = Math.floor(Math.min(MOCK_WIDTH_MAX, h / MOCK_ASPECT, w));
  if (width <= 0) return { width: 0, height: 0, visible: false };
  return {
    width,
    height: Math.round(width * MOCK_ASPECT),
    visible: width >= MOCK_WIDTH_MIN,
  };
}

/**
 * 창 높이만으로 목업을 보여줄지 결정한다 (레이아웃 측정 전 첫 렌더용).
 * 슬라이드 고정 요소(상단바·제목 2줄·부제 2줄·버튼 영역) 합이 약 334px이므로,
 * MOCK_WIDTH_MIN × MOCK_ASPECT(≈271px)를 더한 605px 미만이면 숨긴다.
 */
export const ONBOARDING_FIXED_HEIGHT = 334;
export function shouldShowMockup(windowHeight) {
  if (!Number.isFinite(windowHeight) || windowHeight <= 0) return false;
  return windowHeight - ONBOARDING_FIXED_HEIGHT >= MOCK_WIDTH_MIN * MOCK_ASPECT;
}
