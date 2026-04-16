import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UniversitySelectScreen from '../screens/auth/UniversitySelectScreen';
import SchoolPortalAuthScreen from '../screens/auth/SchoolPortalAuthScreen';
import AcEmailInputScreen from '../screens/auth/AcEmailInputScreen';
import EmailVerificationPendingScreen from '../screens/auth/EmailVerificationPendingScreen';

const Stack = createNativeStackNavigator();

// 로그인 전 화면 묶음
// UniversitySelect → SchoolPortalAuth → (신규) AcEmailInput → EmailVerificationPending
export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UniversitySelect" component={UniversitySelectScreen} />
      <Stack.Screen name="SchoolPortalAuth" component={SchoolPortalAuthScreen} />
      {/* 신규 가입 시 학교 ac.jp 이메일 인증 흐름 */}
      <Stack.Screen name="AcEmailInput" component={AcEmailInputScreen} />
      <Stack.Screen name="EmailVerificationPending" component={EmailVerificationPendingScreen} />
    </Stack.Navigator>
  );
}
