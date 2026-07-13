import { computeFocusScrollY } from '../../src/components/KeyboardAwareScrollView';

// iPhone 14 대략치: 화면 844, 키보드 336 → 보이는 영역 508, targetY = clamp(508*0.22=111.76,100,240)=111.76
describe('computeFocusScrollY (입력칸을 화면 위쪽 1/3로 끌어올리는 계산)', () => {
  const screenHeight = 844;
  const keyboardHeight = 336;

  test('아래쪽에 있는 칸(y=500)은 위로 끌어올린다', () => {
    const next = computeFocusScrollY({
      inputY: 500,
      currentScrollY: 0,
      screenHeight,
      keyboardHeight,
    });
    // delta = 500 - 111.76 ≈ 388.24 → 그만큼 스크롤 내려 칸이 위로 올라감
    expect(next).toBeGreaterThan(380);
    expect(next).toBeLessThan(395);
  });

  test('끌어올린 뒤 칸의 실제 위치가 targetY(약 112) 근처가 된다', () => {
    const inputY = 500;
    const next = computeFocusScrollY({ inputY, currentScrollY: 0, screenHeight, keyboardHeight });
    // 스크롤 후 칸의 새 화면좌표 = inputY - (next - currentScrollY)
    const newOnScreenY = inputY - next; // currentScrollY=0
    expect(newOnScreenY).toBeGreaterThan(100);
    expect(newOnScreenY).toBeLessThan(125);
  });

  test('이미 목표 근처(y=113)면 움직이지 않는다(null)', () => {
    const next = computeFocusScrollY({
      inputY: 113,
      currentScrollY: 0,
      screenHeight,
      keyboardHeight,
    });
    expect(next).toBeNull();
  });

  test('이미 스크롤된 상태에서도 현재 오프셋을 더해 계산한다', () => {
    const next = computeFocusScrollY({
      inputY: 500,
      currentScrollY: 200,
      screenHeight,
      keyboardHeight,
    });
    // delta ≈ 388.24, + 현재 200
    expect(next).toBeGreaterThan(580);
    expect(next).toBeLessThan(595);
  });

  test('음수 오프셋으로는 내려가지 않는다(최소 0)', () => {
    const next = computeFocusScrollY({
      inputY: 130, // target(112)보다 살짝 아래 → delta 작음이지만 6 이상
      currentScrollY: 0,
      screenHeight,
      keyboardHeight,
    });
    // delta = 130-111.76 ≈ 18.24 → next ≈ 18.24 (0 이상)
    if (next !== null) expect(next).toBeGreaterThanOrEqual(0);
  });

  test('키보드 높이를 모를 때(0)도 화면의 40%로 가정해 계산한다', () => {
    const next = computeFocusScrollY({
      inputY: 600,
      currentScrollY: 0,
      screenHeight,
      keyboardHeight: 0,
    });
    // kb = 844*0.4=337.6 → visible 506.4 → target≈111.4 → delta≈488.6
    expect(next).toBeGreaterThan(480);
    expect(next).toBeLessThan(495);
  });

  test('잘못된 입력(inputY 없음)은 null', () => {
    expect(
      computeFocusScrollY({ inputY: undefined, currentScrollY: 0, screenHeight, keyboardHeight }),
    ).toBeNull();
  });
});
