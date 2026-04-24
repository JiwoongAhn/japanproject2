import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useAuth } from '../lib/AuthProvider';
import { supabase } from '../lib/supabase';
import AuthStack from './AuthStack';
import MainTab from './MainTab';
import SplashScreen from '../screens/auth/SplashScreen';
import AcEmailInputScreen from '../screens/auth/AcEmailInputScreen';

const NicknameStack = createNativeStackNavigator();

// 앱 전체 네비게이션 진입점
// 세션 유무에 따라 AuthStack(로그인 전) / MainTab(로그인 후) 자동 전환
// 세션 상태는 AuthProvider에서 관리하므로 여기서는 useAuth()로 꺼내 쓰기만 함

// React Navigation에서 인식할 딥링크 URL 스킴 설정
// Expo Go: exp://192.168.x.x:8081/--/...
// 실제 빌드: unipas://...
const linking = {
  prefixes: [Linking.createURL('/'), 'unipas://'],
};

export default function AppNavigator() {
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    // 이메일 인증 완료 후 앱으로 돌아올 때 URL에서 토큰을 꺼내 세션 설정
    const handleDeepLink = async ({ url }) => {
      if (!url) return;

      // URL 형태: unipas://auth/callback#access_token=xxx&refresh_token=yyy&type=signup
      // '#' 뒤의 파라미터를 파싱
      const fragment = url.split('#')[1];
      if (!fragment) return;

      const params = Object.fromEntries(new URLSearchParams(fragment));

      if (params.access_token && params.refresh_token) {
        // Supabase 세션으로 등록 → AuthProvider의 onAuthStateChange가 자동 감지
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      }
    };

    // 앱이 열려있는 상태에서 딥링크로 들어올 때
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 앱이 완전히 닫혀있다가 딥링크로 실행될 때
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

  // 세션 확인 중일 때 스플래시 화면 표시 (갑작스러운 화면 전환 방지)
  if (loading) return <SplashScreen />;

  // 세션은 있지만 닉네임이 없으면 닉네임 입력 화면 표시 (profile이 null이면 아직 로딩 중)
  const needsNickname = session && profile !== null && !profile?.nickname;

  const renderContent = () => {
    if (!session) return <AuthStack />;
    if (needsNickname) {
      return (
        <NicknameStack.Navigator screenOptions={{ headerShown: false }}>
          <NicknameStack.Screen
            name="NicknameSetup"
            component={AcEmailInputScreen}
            initialParams={{
              userId: session.user.id,
              email: session.user.email,
            }}
          />
        </NicknameStack.Navigator>
      );
    }
    return <MainTab />;
  };

  return (
    <NavigationContainer linking={linking}>
      {renderContent()}
    </NavigationContainer>
  );
}
