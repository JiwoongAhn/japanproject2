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
    // onAuthStateChange만 사용 — supabase-js v2는 구독 시 INITIAL_SESSION 이벤트를 자동 발생시킴
    // getSession()과 동시에 쓰면 setSession이 두 번 호출되는 race condition 발생 가능
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // 컴포넌트 종료 시 리스너 정리 (메모리 누수 방지)
    return () => subscription.unsubscribe();
  }, []);

  // 세션 확인 중(undefined)일 때 SplashScreen UI 표시 — return null 하면 화면이 깜빡임
  if (session === undefined) return <SplashScreen />;

  return (
    <NavigationContainer>
      {session ? <MainTab /> : <AuthStack />}
    </NavigationContainer>
  );
}
