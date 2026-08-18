import { resolveInputStyle } from '../../src/components/AppTextInput';
import { typography } from '../../src/constants/typography';

// 실기 피드백: iOS 한 줄 입력칸에서 이메일「.jp」·닉네임·교원명 아랫부분이 잘렸다.
// 원인 = 화면들이 typography.body1/body2(lineHeight 22~24)를 물려받아, iOS 단일 줄
// TextInput이 descender를 잘라먹는 것. resolveInputStyle이 한 줄 입력칸에서 lineHeight를
// 반드시 제거하는지 검증한다.
describe('resolveInputStyle (입력칸 글자 잘림 방지)', () => {
  test('한 줄 입력칸은 화면이 준 lineHeight를 제거한다', () => {
    const flat = resolveInputStyle({ ...typography.body1, color: '#000' }, false);
    expect(flat.lineHeight).toBeUndefined();
    // 다른 속성은 유지된다
    expect(flat.fontSize).toBe(typography.body1.fontSize);
    expect(flat.color).toBe('#000');
  });

  test('body2(lineHeight 22)를 쓰는 한 줄 입력칸도 lineHeight가 사라진다', () => {
    const flat = resolveInputStyle(typography.body2, false);
    expect(flat.lineHeight).toBeUndefined();
    expect(flat.fontSize).toBe(typography.body2.fontSize);
  });

  test('여러 줄(multiline) 입력칸은 lineHeight를 유지한다(가독성)', () => {
    const flat = resolveInputStyle({ ...typography.body2, lineHeight: 22 }, true);
    expect(flat.lineHeight).toBe(22);
    expect(flat.textAlignVertical).toBe('top');
  });

  test('한 줄 입력칸의 기본 정렬은 center, 여백 패딩은 제거된다', () => {
    const flat = resolveInputStyle(undefined, false);
    expect(flat.textAlignVertical).toBe('center');
    expect(flat.includeFontPadding).toBe(false);
    expect(flat.lineHeight).toBeUndefined();
  });

  test('화면이 지정한 letterSpacing(OTP=12 등)은 기본값(-0.3)을 덮어쓴다', () => {
    const flat = resolveInputStyle({ letterSpacing: 12 }, false);
    expect(flat.letterSpacing).toBe(12);
  });

  test('화면 style이 없어도 안전하게 기본 style을 반환한다', () => {
    const flat = resolveInputStyle(undefined, false);
    expect(flat.letterSpacing).toBe(-0.3);
  });
});
