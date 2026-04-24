import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UniversitySelectScreen from '../screens/auth/UniversitySelectScreen';
import SchoolPortalAuthScreen from '../screens/auth/SchoolPortalAuthScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';

const Stack = createNativeStackNavigator();

// 로그인 전 화면 묶음
// UniversitySelect → SchoolPortalAuth(이메일 입력+OTP 발송) → OtpVerification(코드 입력)
// 신규 회원: OTP 인증 후 AppNavigator가 자동으로 닉네임 입력 화면(AcEmailInput) 표시
// 기존 회원: OTP 인증 후 AppNavigator가 자동으로 MainTab 이동
export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UniversitySelect" component={UniversitySelectScreen} />
      <Stack.Screen name="SchoolPortalAuth" component={SchoolPortalAuthScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
    </Stack.Navigator>
  );
}
