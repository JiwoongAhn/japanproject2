import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/AuthProvider';
import { supabase } from '../lib/supabase';
import AuthStack from './AuthStack';
import MainTab from './MainTab';
import ManabaStack from './ManabaStack';
import SchoolWebViewScreen from '../screens/SchoolWebViewScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import AcEmailInputScreen from '../screens/auth/AcEmailInputScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import MailConnectOnboardingScreen from '../screens/auth/MailConnectOnboardingScreen';
import NoticePreviewModal from '../screens/notice/NoticePreviewModal';
import PrivacyConsentScreen, { PRIVACY_CONSENT_KEY } from '../screens/auth/PrivacyConsentScreen';
import { colors } from '../constants/colors';

// NavigationContainer 밖에서 navigate를 호출하기 위한 ref
const navigationRef = createNavigationContainerRef();

const NicknameStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// 앱 전체 네비게이션 진입점
// 세션 유무에 따라 AuthStack(로그인 전) / MainTab(로그인 후) 자동 전환
// 세션 상태는 AuthProvider에서 관리하므로 여기서는 useAuth()로 꺼내 쓰기만 함

// React Navigation에서 인식할 딥링크 URL 스킴 설정
// Expo Go: exp://192.168.x.x:8081/--/...
// 실제 빌드: unione://...
const linking = {
  prefixes: [Linking.createURL('/'), 'unione://'],
};

export default function AppNavigator() {
  const { session, profile, loading, pendingNotice, clearPendingNotice } = useAuth();

  // 개인정보처리방침 동의 여부 (첫 실행 1회 게이트). null=확인중
  const [consented, setConsented] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(PRIVACY_CONSENT_KEY)
      .then((v) => setConsented(!!v))
      .catch(() => setConsented(false));
  }, []);

  // 푸시 알림 탭 감지 → NoticePreviewModal로 이동
  useEffect(() => {
    if (pendingNotice && navigationRef.isReady()) {
      navigationRef.navigate('NoticePreview', pendingNotice);
    }
  }, [pendingNotice]);

  useEffect(() => {
    // 이메일 인증 완료 후 앱으로 돌아올 때 URL에서 토큰을 꺼내 세션 설정
    const handleDeepLink = async ({ url }) => {
      if (!url) return;

      // URL 형태: unione://auth/callback#access_token=xxx&refresh_token=yyy&type=signup
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

  // 세션/동의 확인 중일 때 스플래시 화면 표시 (갑작스러운 화면 전환 방지)
  if (loading || consented === null) return <SplashScreen />;

  // 개인정보처리방침 미동의 시 가장 먼저 동의 화면 (로그인보다 앞 단계)
  if (!consented) {
    return <PrivacyConsentScreen onConsent={() => setConsented(true)} />;
  }

  // 세션은 있지만 닉네임이 없으면 닉네임 입력 화면 표시 (profile이 null이면 아직 로딩 중)
  const needsNickname = session && profile !== null && !profile?.nickname;
  // 닉네임은 있지만 온보딩 안 했으면 온보딩 표시 (신규 회원만 1회)
  const needsOnboarding = session && profile?.nickname && profile?.onboarding_completed === false;

  const renderContent = () => {
    if (!session) return <AuthStack />;
    if (needsNickname) {
      return (
        <NicknameStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
    if (needsOnboarding) {
      return (
        <OnboardingStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <OnboardingStack.Screen name="Onboarding" component={OnboardingScreen} />
        </OnboardingStack.Navigator>
      );
    }
    // 로그인 완료 상태: MainTab(하단 탭) + Manaba(모달) 형제 등록
    // → 어느 화면에서든 navigation.navigate('Manaba')로 WebView 모달 진입 가능
    return (
      <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <RootStack.Screen name="MainTab" component={MainTab} />
        <RootStack.Screen
          name="Manaba"
          component={ManabaStack}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="SchoolWeb"
          component={SchoolWebViewScreen}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="NoticePreview"
          component={NoticePreviewModal}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="MailConnectOnboarding"
          component={MailConnectOnboardingScreen}
          options={{ presentation: 'modal' }}
        />
      </RootStack.Navigator>
    );
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      {renderContent()}
    </NavigationContainer>
  );
}
