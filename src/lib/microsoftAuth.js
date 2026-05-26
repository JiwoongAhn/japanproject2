import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// expo-auth-session이 웹 브라우저 세션을 올바르게 닫도록 등록
WebBrowser.maybeCompleteAuthSession();

// ─────────────────────────────────────────────────────────────
// Azure AD 앱 설정
// TODO: 3-1 (Azure 앱 등록) 완료 후 CLIENT_ID 값 채우기
// 등록 위치: Azure Portal → Entra ID → 앱 등록 → 개요 → "응용 프로그램(클라이언트) ID"
// ─────────────────────────────────────────────────────────────
const MS_CLIENT_ID = 'b9f03502-37c5-4e9d-88d8-df79bbf9f63b';
const MS_TENANT_ID = 'common'; // 학교 계정(work/school) + 개인 계정 모두 허용

const DISCOVERY = {
  authorizationEndpoint: `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint:         `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
};

// Azure 포털 iOS/macOS 번들 ID 등록으로 자동 생성된 URI와 일치
const REDIRECT_URI = 'msauth.com.jiwoongahn.unipas://auth';

/**
 * Microsoft OAuth PKCE 흐름 실행
 * 성공 시 auth code를 Edge Function으로 전달해 refresh_token 저장 + subscription 생성
 *
 * @returns {{ success: boolean, error?: string }}
 */
export async function connectMicrosoftAccount() {
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     MS_CLIENT_ID,
      scopes:       ['openid', 'email', 'offline_access', 'Mail.Read'],
      redirectUri:  REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      // PKCE: code_verifier/challenge는 expo-auth-session이 자동 생성
      usePKCE: true,
    },
    DISCOVERY,
  );

  // promptAsync()는 훅 외부에서 직접 호출 불가 — 훅 패턴으로 export
  // 사용처(ProfileScreen 등)에서 useMicrosoftAuth()로 호출
  return { request, promptAsync };
}

/**
 * OAuth 완료 후 결과 처리
 * ProfileScreen의 useEffect에서 response가 바뀔 때 호출
 *
 * @param {AuthSession.AuthSessionResult} response
 * @param {AuthSession.AuthRequest|null} request   PKCE code_verifier 포함
 * @returns {{ success: boolean, error?: string }}
 */
export async function handleMicrosoftAuthResponse(response, request) {
  if (!response || response.type !== 'success') {
    if (response?.type === 'cancel') return { success: false, error: 'cancelled' };
    return { success: false, error: response?.type ?? 'unknown' };
  }

  const { code } = response.params;

  // auth code + PKCE verifier를 Edge Function으로 전달
  // Edge Function이 access/refresh token 교환 + Graph subscription 생성을 담당
  const { data, error } = await supabase.functions.invoke('ms-oauth-exchange', {
    body: {
      code,
      redirectUri:   REDIRECT_URI,
      codeVerifier:  request?.codeVerifier,
    },
  });

  if (error) {
    console.error('[MS Auth] Exchange 실패:', error.message);
    return { success: false, error: error.message };
  }

  console.log('[MS Auth] 연결 완료. subscription_id:', data?.subscriptionId);
  return { success: true };
}
