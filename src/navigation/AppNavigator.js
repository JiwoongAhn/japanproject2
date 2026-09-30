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
import AssignmentStack from './AssignmentStack';
import SchoolWebViewScreen from '../screens/SchoolWebViewScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import AcEmailInputScreen from '../screens/auth/AcEmailInputScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import MailConnectOnboardingScreen from '../screens/auth/MailConnectOnboardingScreen';
import ManabaReminderSetupScreen from '../screens/manaba/ManabaReminderSetupScreen';
import NoticePreviewModal from '../screens/notice/NoticePreviewModal';
import PrivacyConsentScreen, { PRIVACY_CONSENT_KEY } from '../screens/auth/PrivacyConsentScreen';
import PushPrimingScreen, { PUSH_PRIMING_KEY } from '../screens/auth/PushPrimingScreen';
import WelcomeScreen, { WELCOME_SEEN_KEY } from '../screens/auth/WelcomeScreen';
import { resolveAuthGate } from '../utils/authRoute';
import { colors } from '../constants/colors';
import WideScreenContainer from '../components/WideScreenContainer';

// NavigationContainer 밖에서 navigate를 호출하기 위한 ref
const navigationRef = createNavigationContainerRef();

// iOS 의 네이티브 모달은 별도 뷰 컨트롤러로 루트 윈도우에 올라간다.
// 그래서 App.js 의 WideScreenContainer 바깥에 놓이고, 아이패드에서 모달만
// 화면 폭 전체로 펼쳐져 나머지 화면(가운데 컬럼)과 어긋난다(2026-09-30 실측).
// → 앱 자체 UI 인 모달은 각자 한 번 더 감싼다.
//   외부 사이트를 띄우는 WebView 모달(manaba·학교 사이트)은 감싸지 않는다.
//   남의 웹페이지는 큰 화면에서 넓게 보는 편이 실용적이기 때문이다.
// ⚠️ 모듈 레벨에서 한 번만 만든다. 렌더마다 새로 만들면 화면이 통째로 리마운트된다.
const withWideScreen = (Component) => {
  const Wrapped = (props) => (
    <WideScreenContainer>
      <Component {...props} />
    </WideScreenContainer>
  );
  Wrapped.displayName = `WideScreen(${Component.displayName || Component.name || 'Screen'})`;
  return Wrapped;
};

const AssignmentModal           = withWideScreen(AssignmentStack);
const NoticePreviewModalWide    = withWideScreen(NoticePreviewModal);
const MailConnectOnboardingWide = withWideScreen(MailConnectOnboardingScreen);
const ManabaReminderSetupWide   = withWideScreen(ManabaReminderSetupScreen);
const OnboardingReviewWide      = withWideScreen(OnboardingScreen);

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
  // 인증 콜백(unione://auth/callback#access_token=…)은 아래 handleDeepLink 가 직접 처리한다.
  // React Navigation 이 이를 화면 경로로 해석하면 "NAVIGATE … not handled" 에러가 나므로 제외.
  filter: (url) => !url.includes('auth/callback'),
};

export default function AppNavigator() {
  const { session, profile, loading, pendingNotice, clearPendingNotice, bootStalled, retryBoot } = useAuth();

  // 환영 화면 노출 여부 (첫 실행 1회 게이트, 개인정보 동의보다 앞). null=확인중
  const [welcomeSeen, setWelcomeSeen] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((v) => setWelcomeSeen(!!v))
      .catch(() => setWelcomeSeen(false));
  }, []);
  const markWelcomeSeen = () => {
    AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => {});
    setWelcomeSeen(true);
  };

  // 개인정보처리방침 동의 여부 (첫 실행 1회 게이트). null=확인중
  const [consented, setConsented] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(PRIVACY_CONSENT_KEY)
      .then((v) => setConsented(!!v))
      .catch(() => setConsented(false));
  }, []);

  // 통지 프리퍼미션 화면 노출 여부 (기기 단위 1회 게이트). null=확인중
  const [pushPrimingDone, setPushPrimingDone] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(PUSH_PRIMING_KEY)
      .then((v) => setPushPrimingDone(!!v))
      .catch(() => setPushPrimingDone(false));
  }, []);
  const markPushPrimingDone = () => {
    AsyncStorage.setItem(PUSH_PRIMING_KEY, '1').catch(() => {});
    setPushPrimingDone(true);
  };

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

  // 지금 보여줄 화면을 순수 함수로 결정 (분기 로직은 utils/authRoute에서 테스트)
  const gate = resolveAuthGate({ loading, welcomeSeen, consented, pushPrimingDone, session, profile });

  // 로그인 이전 게이트 + 스플래시는 NavigationContainer 바깥에서 바로 반환
  // 세션은 저장돼 있는데 확인이 계속 실패하는 중 → 로그아웃시키지 말고 재시도 안내
  if (bootStalled) return <SplashScreen onRetry={retryBoot} />;
  if (gate === 'splash') return <SplashScreen />;
  if (gate === 'welcome') return <WelcomeScreen onStart={markWelcomeSeen} />;
  if (gate === 'consent') return <PrivacyConsentScreen onConsent={() => setConsented(true)} />;

  const renderContent = () => {
    if (gate === 'auth') return <AuthStack />;
    if (gate === 'pushPriming') {
      return <PushPrimingScreen onDone={markPushPrimingDone} />;
    }
    if (gate === 'nickname') {
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
    if (gate === 'onboarding') {
      return (
        <OnboardingStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <OnboardingStack.Screen name="Onboarding" component={OnboardingScreen} />
        </OnboardingStack.Navigator>
      );
    }
    // 로그인 완료 상태(gate==='main'): MainTab(하단 탭) + Manaba(모달) 형제 등록
    // → 어느 화면에서든 navigation.navigate('Manaba')로 WebView 모달 진입 가능
    return (
      <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <RootStack.Screen name="MainTab" component={MainTab} />
        <RootStack.Screen
          name="Manaba"
          component={ManabaStack}
          options={{ presentation: 'modal' }}
        />
        {/* 課題 — 하단 탭에서 빼고 모달로 전환(실사용 0건).
            홈 카드·時間割 셀·통지 프리뷰에서 navigate('Assignment')로 계속 열 수 있다. */}
        <RootStack.Screen
          name="Assignment"
          component={AssignmentModal}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="SchoolWeb"
          component={SchoolWebViewScreen}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="NoticePreview"
          component={NoticePreviewModalWide}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="MailConnectOnboarding"
          component={MailConnectOnboardingWide}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="ManabaReminderSetup"
          component={ManabaReminderSetupWide}
          options={{ presentation: 'modal' }}
        />
        {/* 마이페이지 "使い方をもう一度見る"에서 여는 온보딩 다시 보기(모달, DB 미변경) */}
        <RootStack.Screen
          name="OnboardingReview"
          component={OnboardingReviewWide}
          options={{ presentation: 'modal' }}
          initialParams={{ review: true }}
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
