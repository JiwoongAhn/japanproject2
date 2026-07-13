// 포커스된 입력칸을 "화면 위쪽(대략 상단 1/3)"으로 실제로 끌어올려 주는 ScrollView.
//
// 왜 필요한가:
//   iOS의 automaticallyAdjustKeyboardInsets는 "입력칸이 키보드에 가려지지 않게"만 한다.
//   즉 칸이 키보드 바로 위에 걸쳐 보일 뿐, 화면 위쪽으로 옮겨주지는 않는다.
//   또 폼이 짧으면 스크롤 자체가 안 일어나 "아무 변화가 없어" 보인다.
//   → 여기서는 탭한 칸의 실제 화면 좌표를 measure한 뒤, 그 칸의 윗변이
//     "키보드 위 보이는 영역의 위쪽 약 1/4~1/3 지점"에 오도록 직접 scrollTo 한다.
//
// 어떻게 전 화면에 한 번에 적용되나:
//   화면들은 전부 공용 <AppTextInput>을 쓴다. AppTextInput이 포커스될 때 아래
//   Context의 함수(handleInputFocus)를 호출하도록 연결해 두면(=AppTextInput.js),
//   이 컨테이너 안의 모든 입력칸이 자동으로 스크롤 대상이 된다.
//   (라이브러리/네이티브 모듈 없이 순수 JS라 OTA 업데이트로도 반영된다.)

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { ScrollView, Keyboard, Dimensions, Platform } from 'react-native';

const FocusScrollContext = createContext(null);

// AppTextInput에서 포커스 시 호출할 함수를 꺼내 쓰기 위한 훅.
// 컨테이너 밖(Provider 없음)에서는 null을 돌려주므로 안전하게 무시된다.
export function useFocusScroll() {
  return useContext(FocusScrollContext);
}

// 포커스된 칸을 어디로 스크롤할지 계산하는 순수 함수(테스트 대상).
//   inputY         : 화면(윈도우) 기준 칸 윗변의 현재 Y
//   currentScrollY : 현재 스크롤 오프셋
//   screenHeight   : 화면 전체 높이
//   keyboardHeight : 키보드 높이(0이면 화면의 40%로 가정)
// 반환: 스크롤할 새 오프셋(number) / 이동 불필요하면 null
export function computeFocusScrollY({ inputY, currentScrollY, screenHeight, keyboardHeight }) {
  if (typeof inputY !== 'number' || typeof screenHeight !== 'number') return null;
  const kb = keyboardHeight || screenHeight * 0.4;
  const visibleH = screenHeight - kb; // 키보드 위 보이는 영역
  // 칸 윗변을 보이는 영역의 위쪽 약 22% 지점(≈ 상단 1/3)에. 헤더 가림 방지 최소 100, 최대 240.
  const targetY = Math.min(Math.max(100, visibleH * 0.22), 240);
  const delta = inputY - targetY; // +면 칸이 아래 → 그만큼 스크롤 내림
  if (Math.abs(delta) < 6) return null; // 이미 거의 제자리
  return Math.max(0, currentScrollY + delta);
}

export default function KeyboardAwareScrollView({ children, ...props }) {
  const scrollRef = useRef(null);
  const scrollY = useRef(0); // 현재 스크롤 오프셋(스크롤할 때마다 갱신)
  const keyboardHeight = useRef(0); // 현재 키보드 높이(키보드 이벤트로 갱신)

  // 키보드 높이 추적: 보이는 영역 계산에 필요
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      keyboardHeight.current = e?.endCoordinates?.height ?? 0;
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      keyboardHeight.current = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleScroll = useCallback(
    (e) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      props.onScroll?.(e); // 화면이 자체 onScroll을 넘겨도 체인
    },
    [props],
  );

  // 포커스된 입력칸(native node)을 화면 위쪽으로 이동
  const handleInputFocus = useCallback((node) => {
    if (!node || !scrollRef.current) return;

    const run = () => {
      // measureInWindow: 화면(윈도우) 기준 절대 좌표
      node.measureInWindow((x, y, w, h) => {
        const nextY = computeFocusScrollY({
          inputY: y,
          currentScrollY: scrollY.current,
          screenHeight: Dimensions.get('window').height,
          keyboardHeight: keyboardHeight.current,
        });
        if (nextY == null) return; // 이동 불필요
        scrollRef.current?.scrollTo({ y: nextY, animated: true });
      });
    };

    // iOS는 keyboardWillShow가 먼저 도착하도록, Android는 레이아웃이 잡히도록 약간 지연
    setTimeout(run, Platform.OS === 'ios' ? 60 : 120);
  }, []);

  return (
    <FocusScrollContext.Provider value={handleInputFocus}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        {...props}
        onScroll={handleScroll}
      >
        {children}
      </ScrollView>
    </FocusScrollContext.Provider>
  );
}
