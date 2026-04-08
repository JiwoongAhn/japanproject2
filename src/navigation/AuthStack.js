import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UniversitySelectScreen from '../screens/auth/UniversitySelectScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

const Stack = createNativeStackNavigator();

// 로그인 전 화면 묶음
// UniversitySelect → Login → SignUp
// SplashScreen은 AppNavigator가 세션 확인 중에 직접 표시 (AuthStack 밖)
export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UniversitySelect" component={UniversitySelectScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
