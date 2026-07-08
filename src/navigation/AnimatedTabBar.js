import React from 'react';
import { Animated, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { radius, shadow } from '../constants/spacing';
import { useTabBarScroll } from './TabBarScrollContext';

// 확장/축소 시 바의 콘텐츠 높이(안전영역 제외)
const EXPANDED_BAR = 64;  // 아이콘 + 라벨
const COLLAPSED_BAR = 50; // 아이콘만
const LABEL_HEIGHT = 14;

const ACTIVE = '#191F28';
const INACTIVE = '#B0B8C1';

// 토스 스타일: 화면 하단에 꽉 찬 전체폭 바 + 윗모서리만 둥글게.
// 스크롤 내리면 라벨이 작아지며 사라지고 아이콘만 남아 바가 납작해진다.
export default function AnimatedTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { collapse } = useTabBarScroll();
  const c = collapse ?? new Animated.Value(0);

  const bottomPad = insets.bottom || 12;

  // 바 전체 높이(콘텐츠 + 안전영역). 확장 시 위로 자라며, 예약 공간은 축소 높이.
  const barHeight = c.interpolate({
    inputRange: [0, 1],
    outputRange: [EXPANDED_BAR + bottomPad, COLLAPSED_BAR + bottomPad],
  });
  const labelOpacity = c.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0, 0] });
  const labelHeight = c.interpolate({ inputRange: [0, 1], outputRange: [LABEL_HEIGHT, 0] });
  const labelScale = c.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });

  return (
    // 이 View의 고정 높이만큼 네비게이터가 하단 공간을 예약한다(= 확장 높이).
    // 바는 이 영역 '안'에서 아래로 줄어들어, 넘침(overflow) 잘림 위험이 없다.
    // 축소 시 바 위로 생기는 소량의 빈 공간은 화면 배경색이라 자연스럽다.
    <View style={{ height: EXPANDED_BAR + bottomPad }} pointerEvents="box-none">
      <Animated.View style={[styles.bar, { height: barHeight, paddingBottom: bottomPad }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? ACTIVE : INACTIVE;
          const label = options.tabBarLabel ?? options.title ?? route.name;

          const onPress = () => {
            // 기본 탭 동작 + 화면별 listeners.tabPress(예: 게시판 목록 리셋)가 그대로 발동
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={typeof label === 'string' ? label : undefined}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.item}
              activeOpacity={0.7}
            >
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color, opacity: labelOpacity, height: labelHeight, transform: [{ scale: labelScale }] },
                ]}
              >
                {label}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.tabBar,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    overflow: 'hidden',
  },
});
