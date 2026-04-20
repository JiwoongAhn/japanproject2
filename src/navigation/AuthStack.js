import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UniversitySelectScreen from '../screens/auth/UniversitySelectScreen';
import SchoolPortalAuthScreen from '../screens/auth/SchoolPortalAuthScreen';
import AcEmailInputScreen from '../screens/auth/AcEmailInputScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import EmailVerificationPendingScreen from '../screens/auth/EmailVerificationPendingScreen';

const Stack = createNativeStackNavigator();

// 로그인 전 화면 묶음
// UniversitySelect → SchoolPortalAuth → AcEmailInput → OtpVerification → (자동) MainTab
export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UniversitySelect" component={UniversitySelectScreen} />
      <Stack.Screen name="SchoolPortalAuth" component={SchoolPortalAuthScreen} />
      <Stack.Screen name="AcEmailInput" component={AcEmailInputScreen} />
      {/* OTP 인증: 학교 이메일로 6자리 코드 발송 → 입력 → 계정 생성 */}
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="EmailVerificationPending" component={EmailVerificationPendingScreen} />
    </Stack.Navigator>
  );
}
