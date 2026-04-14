import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UniversitySelectScreen from '../screens/auth/UniversitySelectScreen';
import SchoolPortalAuthScreen from '../screens/auth/SchoolPortalAuthScreen';

const Stack = createNativeStackNavigator();

// 로그인 전 화면 묶음
// UniversitySelect → SchoolPortalAuth (학교 포털 ID/비번으로 인증)
export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UniversitySelect" component={UniversitySelectScreen} />
      <Stack.Screen name="SchoolPortalAuth" component={SchoolPortalAuthScreen} />
    </Stack.Navigator>
  );
}
