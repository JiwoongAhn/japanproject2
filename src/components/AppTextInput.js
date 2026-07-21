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
import { TextInput } from 'react-native';
import { useFocusScroll } from './KeyboardAwareScrollView';

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
      style={[
        // letterSpacing: 앱 타이포(제목 −0.2~−0.5)와 달리 입력칸은 0이라 일본어
        // placeholder가 상대적으로 벌어져 보였다(#5·11·15·16). 살짝 좁혀 통일한다.
        // 개별 화면이 letterSpacing을 지정하면(OTP=12 등) 그 값이 우선한다.
        { includeFontPadding: false, textAlignVertical: multiline ? 'top' : 'center', letterSpacing: -0.3 },
        style,
      ]}
    />
  );
});

export default AppTextInput;
