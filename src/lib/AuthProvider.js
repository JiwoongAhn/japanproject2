import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import {
  registerPushToken,
  setupNotificationListeners,
  handleInitialNotification,
} from './notifications';
import {
  attachAutoRefresh,
  hasStoredSession,
  raceWithTimeout,
  resolveBootOutcome,
  BOOT_TIMEOUT_MS,
  BOOT_MAX_ATTEMPTS,
} from './sessionKeeper';

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
  // 기기에 세션은 저장돼 있는데 확인이 계속 실패하는 상태(네트워크 문제 등).
  // true면 로그아웃시키지 않고 "재시도" 안내를 보여준다.
  const [bootStalled, setBootStalled] = useState(false);
  // 세션 복원을 다시 돌리기 위한 트리거 (재시도 버튼)
  const [bootAttemptKey, setBootAttemptKey] = useState(0);
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

  // 앱 시작 시 세션 복원
  //
  // ⚠️ 예전 코드는 "5초 안에 응답이 없으면 무조건 로그아웃"이었다. 네트워크가 느린
  //    곳에서 멀쩡히 로그인된 사용자를 대학 선택 화면으로 튕겨내던 원인(실기 버그 ⑥).
  //    지금은 기기에 저장된 세션이 있으면 로그아웃시키지 않고 재시도하고,
  //    끝내 실패하면 재시도 안내(bootStalled)를 띄운다.
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      for (let attempt = 0; attempt < BOOT_MAX_ATTEMPTS; attempt += 1) {
        const result = await raceWithTimeout(supabase.auth.getSession(), BOOT_TIMEOUT_MS);
        if (cancelled) return;

        const stored = result?.data ? false : await hasStoredSession(AsyncStorage);
        if (cancelled) return;

        const outcome = resolveBootOutcome({ result, stored, attempt });

        if (outcome === 'session') {
          const restored = result?.data?.session ?? null;
          setBootStalled(false);
          setSession(restored);
          fetchProfile(restored?.user?.id ?? null);
          return;
        }
        if (outcome === 'logout') {
          setSession(prev => (prev === undefined ? null : prev));
          return;
        }
        if (outcome === 'stalled') {
          // 저장된 세션은 있는데 확인이 안 됨 → 로그아웃시키지 않고 재시도 안내
          setBootStalled(true);
          return;
        }
        // 'retry' → 루프 계속
      }
    };

    restoreSession();
    return () => { cancelled = true; };
  }, [bootAttemptKey]);

  useEffect(() => {
    // 토큰 자동갱신을 AppState와 연결 (백그라운드 복귀 후 자동 로그아웃 방지)
    const detachAutoRefresh = attachAutoRefresh({ appState: AppState, auth: supabase.auth });

    // 이후 로그인/로그아웃 이벤트를 실시간으로 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 세션 확인이 늦어져 재시도 안내를 띄웠더라도, 여기서 결과가 오면 즉시 해제한다
      if (session) setBootStalled(false);
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
      detachAutoRefresh();
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
    bootStalled,                      // 세션 복원이 계속 실패하는 중 (로그아웃 아님)
    retryBoot: () => {                // 재시도 버튼용
      setBootStalled(false);
      setBootAttemptKey(k => k + 1);
    },
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
