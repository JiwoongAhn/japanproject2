import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

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

  // 세션이 생기면 프로필(닉네임) 확인
  const fetchProfile = async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, university, school_email')
      .eq('id', userId)
      .maybeSingle();
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      fetchProfile(session?.user?.id ?? null);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,                          // 전체 세션 객체 (null이면 비로그인)
    user: session?.user ?? null,      // 현재 로그인 유저 정보
    profile,                          // profiles 테이블 데이터 (nickname 포함)
    loading: session === undefined,   // 세션 확인 중 여부
    refreshProfile: () => fetchProfile(session?.user?.id ?? null),
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
