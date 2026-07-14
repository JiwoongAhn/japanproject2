import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import {
  registerPushToken,
  setupNotificationListeners,
  handleInitialNotification,
} from './notifications';

// ─────────────────────────────────────────────────────────────────────────────
// AuthContext — 앱 전역 인증 상태를 공유하는 Context
//
// 사용법:
//   import { useAuth } from '../lib/AuthProvider';
//   const { session, user, loading } = useAuth();
//
// 왜 Context를 쓰나요?
//   AppNavigator에서만 session을 갖고 있으면, 다른 화면에서 "지금 로그인한
//   사람이 누구지?" 를 알 수 없습니다. Context에 담아두면 어느 화면에서든
//   useAuth() 한 줄로 꺼내 쓸 수 있습니다.
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined: 아직 세션 확인 중 / null: 로그아웃 / Session 객체: 로그인 중
  const [session, setSession] = useState(undefined);
  // null: 미확인 / 객체: 프로필 데이터
  const [profile, setProfile] = useState(null);
  // 사용자가 탭한 푸시 알림 데이터 — AppNavigator에서 watch해 NoticePreviewModal 오픈
  const [pendingNotice, setPendingNotice] = useState(null);
  // 같은 세션에서 registerPushToken 중복 호출 방지
  const pushRegistered = useRef(false);

  // 세션이 생기면 프로필(닉네임) 확인
  // 신규 가입 직후엔 handle_new_user 트리거로 profiles 행이 막 생성되는 타이밍이라
  // 첫 조회가 null일 수 있다 → 잠깐 뒤 재시도 (profile을 null로 확정하지 않음).
  // 재시도 동안 AppNavigator는 'splash'를 유지해 메인 조기 진입(온보딩 건너뜀)을 막는다.
  const fetchProfile = async (userId, retriesLeft = 4) => {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, university, school_email, onboarding_completed')
      .eq('id', userId)
      .maybeSingle();
    if (!data && retriesLeft > 0) {
      setTimeout(() => fetchProfile(userId, retriesLeft - 1), 500);
      return;
    }
    setProfile(data ?? null);
  };

  useEffect(() => {
    // Supabase 응답이 5초 이상 없으면 로그인 화면으로 강제 이동
    const timeout = setTimeout(() => {
      setSession(prev => (prev === undefined ? null : prev));
    }, 5000);

    // 앱 시작 시 현재 세션 즉시 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session ?? null);
      fetchProfile(session?.user?.id ?? null);
    });

    // 이후 로그인/로그아웃 이벤트를 실시간으로 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null);
      fetchProfile(session?.user?.id ?? null);

      // 로그인 완료 시 푸시 토큰 등록 (세션 중 1회만)
      // prompt:false — 권한 팝업은 프리퍼미션 화면(PushPrimingScreen)에서 요청한다.
      // 이미 허용한 사용자는 여기서 토큰만 조용히 갱신된다.
      if (event === 'SIGNED_IN' && !pushRegistered.current) {
        pushRegistered.current = true;
        registerPushToken({ prompt: false });
      }
      // 로그아웃 시 다음 로그인을 위해 초기화
      if (event === 'SIGNED_OUT') {
        pushRegistered.current = false;
      }
    });

    // 푸시 리스너 등록 — tap 시 pendingNotice 업데이트 (navigation은 AppNavigator에서 처리)
    const noticeHandler = (noticeData) => setPendingNotice(noticeData);
    const cleanupListeners = setupNotificationListeners(noticeHandler);

    // 앱이 종료된 상태에서 탭한 알림 처리
    handleInitialNotification(noticeHandler);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      cleanupListeners();
    };
  }, []);

  const value = {
    session,                          // 전체 세션 객체 (null이면 비로그인)
    user: session?.user ?? null,      // 현재 로그인 유저 정보
    profile,                          // profiles 테이블 데이터 (nickname 포함)
    loading: session === undefined,   // 세션 확인 중 여부
    refreshProfile: () => fetchProfile(session?.user?.id ?? null),
    pendingNotice,                    // 탭된 푸시 알림 데이터 (AppNavigator에서 watch)
    clearPendingNotice: () => setPendingNotice(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 다른 화면에서 useAuth()로 쉽게 꺼내 쓰는 커스텀 훅
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth()는 <AuthProvider> 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}
