import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TimetableScreen from '../screens/timetable/TimetableScreen';
import CourseAddScreen from '../screens/timetable/CourseAddScreen';
import CourseReviewScreen from '../screens/timetable/CourseReviewScreen';
import CourseReviewDetailScreen from '../screens/timetable/CourseReviewDetailScreen';
import CourseReviewCreateScreen from '../screens/timetable/CourseReviewCreateScreen';
import FreeTimeScreen from '../screens/timetable/FreeTimeScreen';

// 시간표 탭 안에서만 사용하는 스택 네비게이터
// TimetableScreen(그리드) → CourseAddScreen(수업 추가 폼) 이동을 관리
// 하단 메뉴 카드 → CourseReviewScreen, FreeTimeScreen 이동도 관리
const Stack = createNativeStackNavigator();

export default function TimetableStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* 기본 화면: 시간표 그리드 */}
      <Stack.Screen name="TimetableMain" component={TimetableScreen} />
      {/* 수업 추가 폼: + 버튼 누르면 이 화면으로 이동 */}
      <Stack.Screen name="CourseAdd" component={CourseAddScreen} />
      {/* 강의평가 목록 화면 */}
      <Stack.Screen name="CourseReview" component={CourseReviewScreen} />
      {/* 강의평가 상세 화면 (수업별 전체 리뷰 목록) */}
      <Stack.Screen name="CourseReviewDetail" component={CourseReviewDetailScreen} />
      {/* 강의평가 작성 화면 */}
      <Stack.Screen name="CourseReviewCreate" component={CourseReviewCreateScreen} />
      {/* 공강맞추기 화면 */}
      <Stack.Screen name="FreeTime" component={FreeTimeScreen} />
    </Stack.Navigator>
  );
}
