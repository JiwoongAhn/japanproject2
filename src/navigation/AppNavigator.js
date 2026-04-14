import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../lib/AuthProvider';
import AuthStack from './AuthStack';
import MainTab from './MainTab';
import SplashScreen from '../screens/auth/SplashScreen';

// 앱 전체 네비게이션 진입점
// 세션 유무에 따라 AuthStack(로그인 전) / MainTab(로그인 후) 자동 전환
// 세션 상태는 AuthProvider에서 관리하므로 여기서는 useAuth()로 꺼내 쓰기만 함
export default function AppNavigator() {
  const { session, loading } = useAuth();

  // 세션 확인 중일 때 스플래시 화면 표시 (갑작스러운 화면 전환 방지)
  if (loading) return <SplashScreen />;

  return (
    <NavigationContainer>
      {session ? <MainTab /> : <AuthStack />}
    </NavigationContainer>
  );
}
