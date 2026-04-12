import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AuthStack from './AuthStack';
import MainTab from './MainTab';
import SplashScreen from '../screens/auth/SplashScreen';

// 앱 전체 네비게이션 진입점
// 세션 유무에 따라 AuthStack(로그인 전) / MainTab(로그인 후) 자동 전환
export default function AppNavigator() {
  const [session, setSession] = useState(undefined); // undefined = 아직 확인 중

  useEffect(() => {
    // 5초 안에 세션 응답이 없으면 강제로 로그인 화면으로 이동
    // (Supabase 연결 실패 시 스플래시 화면에서 무한 대기하는 문제 방지)
    const timeout = setTimeout(() => {
      setSession(prev => prev === undefined ? null : prev);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(timeout);
      setSession(session);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // 세션 확인 중(undefined)일 때 SplashScreen UI 표시 — return null 하면 화면이 깜빡임
  if (session === undefined) return <SplashScreen />;

  // ── 개발 UI 미리보기: 로그인 없이 메인 화면 확인 (개발 완료 후 아래 블록 원래대로 되돌릴 것) ──
  return <NavigationContainer><MainTab /></NavigationContainer>;

  // return (
  //   <NavigationContainer>
  //     {session ? <MainTab /> : <AuthStack />}
  //   </NavigationContainer>
  // );
}
