import React, { createContext, useContext, useRef } from 'react';
import { Animated } from 'react-native';

// 하단 탭바가 각 화면의 스크롤 방향을 알 수 있게 공유하는 Context.
// collapse: 0 = 확장(아이콘+라벨) / 1 = 축소(아이콘만). 커스텀 탭바가 이 값으로 크기·라벨을 보간한다.
const TabBarScrollContext = createContext(null);

export function TabBarScrollProvider({ children }) {
  const collapse = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);         // 직전 스크롤 위치
  const collapsedRef = useRef(false); // 현재 축소 상태 (중복 애니메이션 방지)

  const animateTo = (to) => {
    Animated.timing(collapse, {
      toValue: to,
      duration: 180,
      useNativeDriver: false, // height 등 레이아웃 값을 애니메이션하므로 false
    }).start();
  };

  // 각 화면의 ScrollView/FlatList onScroll에 연결
  const handleScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;

    // 최상단 근처에서는 항상 확장 (짧은 목록에서 갇히지 않도록)
    if (y <= 4) {
      if (collapsedRef.current) { collapsedRef.current = false; animateTo(0); }
      return;
    }
    // 작은 흔들림은 무시하는 방향 임계값
    if (dy > 6 && !collapsedRef.current) {
      collapsedRef.current = true; animateTo(1);  // 아래로 스크롤 → 축소
    } else if (dy < -6 && collapsedRef.current) {
      collapsedRef.current = false; animateTo(0); // 위로 스크롤 → 확장
    }
  };

  return (
    <TabBarScrollContext.Provider value={{ collapse, handleScroll }}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

// Provider 밖에서 호출돼도 안전하도록 no-op 기본값 반환
export function useTabBarScroll() {
  return useContext(TabBarScrollContext) ?? { collapse: null, handleScroll: () => {} };
}
