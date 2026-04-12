import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AssignmentScreen from '../screens/AssignmentScreen';
import AssignmentAddScreen from '../screens/assignment/AssignmentAddScreen';

// 과제 탭 안에서 사용하는 스택 네비게이터
// AssignmentScreen(목록) → AssignmentAddScreen(추가 폼) 이동을 관리
const Stack = createNativeStackNavigator();

export default function AssignmentStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AssignmentMain" component={AssignmentScreen} />
      <Stack.Screen name="AssignmentAdd" component={AssignmentAddScreen} />
    </Stack.Navigator>
  );
}
