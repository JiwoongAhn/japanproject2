// 앱 전체 공용 입력칸 래퍼.
// 왜 필요한가:
//   (1) 안드로이드 TextInput은 기본값(includeFontPadding=true)과 typography의
//       lineHeight가 겹치면 글자가 아래로 밀려 아랫부분이 잘린다(#7).
//       여기서 한 번만 보정해두면, 이걸 쓰는 모든 화면이 함께 고쳐진다.
//         - includeFontPadding: false → 폰트 위아래 여분 패딩 제거
//         - textAlignVertical         → 한 줄은 세로 가운데, 여러 줄은 위 정렬
//   (2) 포커스되면 KeyboardAwareScrollView에 알려, 탭한 칸을 화면 위쪽으로
//       스크롤해 준다. (컨테이너가 없으면 조용히 무시)
// 화면 쪽 style을 배열 뒤에 두어, 필요하면 개별 화면이 덮어쓸 수 있게 한다.
import { forwardRef, useCallback, useRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { useFocusScroll } from './KeyboardAwareScrollView';

// 입력칸에 적용할 최종 style을 계산한다(순수 함수라 테스트로 검증 가능).
//  - 기본값(includeFontPadding·textAlignVertical·letterSpacing)을 먼저 깔고
//    화면 style을 뒤에 병합해 개별 화면이 덮어쓸 수 있게 한다.
//  - ⚠️ 한 줄 입력칸은 lineHeight 키 자체를 삭제한다. 화면들이
//    typography.body1/body2(lineHeight 22~24)를 그대로 쓰는데, iOS 단일 줄
//    TextInput은 lineHeight가 있으면 g·p·「.jp」처럼 아래로 뻗는 글자의 아랫부분을
//    잘라먹는다(실기 피드백: 이메일·닉네임·교원명 잘림). 키를 delete 하면 iOS가
//    세로 가운데 정렬해 잘림이 사라진다. undefined 오버라이드가 아니라 키를 지워
//    RN 버전과 무관하게 확실히 제거한다. 여러 줄(multiline)은 lineHeight를 유지한다.
export function resolveInputStyle(style, multiline) {
  const flat = StyleSheet.flatten([
    { includeFontPadding: false, textAlignVertical: multiline ? 'top' : 'center', letterSpacing: -0.3 },
    style,
  ]) || {};
  if (!multiline && flat.lineHeight != null) {
    delete flat.lineHeight;
  }
  return flat;
}

const AppTextInput = forwardRef(function AppTextInput(
  { style, multiline = false, onFocus, ...props },
  ref,
) {
  const innerRef = useRef(null);
  const focusScroll = useFocusScroll();

  // 외부에서 넘긴 ref와 내부 ref를 둘 다 채운다(포커스 시 measure에 내부 ref 사용).
  const setRefs = useCallback(
    (node) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const handleFocus = useCallback(
    (e) => {
      if (focusScroll && innerRef.current) focusScroll(innerRef.current);
      onFocus?.(e); // 화면이 준 onFocus도 그대로 실행
    },
    [focusScroll, onFocus],
  );

  return (
    <TextInput
      ref={setRefs}
      multiline={multiline}
      {...props}
      onFocus={handleFocus}
      style={resolveInputStyle(style, multiline)}
    />
  );
});

export default AppTextInput;
