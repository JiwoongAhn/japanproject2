// 앱 전체 공용 입력칸 래퍼.
// 왜 필요한가: 안드로이드 TextInput은 기본값(includeFontPadding=true)과
// typography의 lineHeight가 겹치면 글자가 아래로 밀려 아랫부분이 잘린다(#7).
// 여기서 한 번만 보정해두면, TextInput 대신 이걸 쓰는 모든 화면이 함께 고쳐진다.
//   - includeFontPadding: false → 폰트 위아래 여분 패딩 제거
//   - textAlignVertical         → 한 줄 입력은 세로 가운데, 여러 줄은 위 정렬
// 화면 쪽 style을 배열 뒤에 두어, 필요하면 개별 화면이 덮어쓸 수 있게 한다.
import { forwardRef } from 'react';
import { TextInput } from 'react-native';

const AppTextInput = forwardRef(function AppTextInput({ style, multiline = false, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      {...props}
      style={[
        { includeFontPadding: false, textAlignVertical: multiline ? 'top' : 'center' },
        style,
      ]}
    />
  );
});

export default AppTextInput;
