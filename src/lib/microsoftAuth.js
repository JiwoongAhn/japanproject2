import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// expo-auth-session이 웹 브라우저 세션을 올바르게 닫도록 등록
WebBrowser.maybeCompleteAuthSession();

// ─────────────────────────────────────────────────────────────
// Azure AD 앱 설정
// ─────────────────────────────────────────────────────────────
const MS_CLIENT_ID = 'b9f03502-37c5-4e9d-88d8-df79bbf9f63b';
const MS_TENANT_ID = 'common'; // 학교 계정(work/school) + 개인 계정 모두 허용

// expo-auth-session의 useAuthRequest에 그대로 넘길 수 있도록 export
// (ProfileScreen·MailConnectOnboardingScreen 등 여러 화면이 동일 설정을 공유)
export const MS_DISCOVERY = {
  authorizationEndpoint: `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint:         `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
};

// Azure 포털 iOS/macOS 번들 ID 등록으로 자동 생성된 URI와 일치
export const MS_REDIRECT_URI = 'msauth.com.jiwoongahn.unipas://auth';

// 내부 참조용 별칭 (기존 코드 호환)
const DISCOVERY = MS_DISCOVERY;
const REDIRECT_URI = MS_REDIRECT_URI;

// useAuthRequest 첫 번째 인자로 그대로 사용 가능한 OAuth 요청 설정
// scopes: Mail.Read(받은편지함 읽기) + offline_access(refresh_token 발급용)
export const MS_AUTH_REQUEST = {
  clientId:     MS_CLIENT_ID,
  scopes:       ['openid', 'email', 'offline_access', 'Mail.Read'],
  redirectUri:  MS_REDIRECT_URI,
  responseType: AuthSession.ResponseType.Code,
  usePKCE:      true,
  prompt:       'select_account',
};

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

  // 디버깅: MS 토큰 교환 실패 시 실제 에러 메시지 표시
  if (data?.msError) {
    console.error('[MS Auth] MS 토큰 에러 상세:', data.msError);
    return { success: false, error: `MS오류(${data.msStatus}): ${data.msError}` };
  }

  if (!data?.success) {
    console.error('[MS Auth] 실패 응답:', JSON.stringify(data));
    return { success: false, error: JSON.stringify(data) };
  }

  console.log('[MS Auth] 연결 완료. subscription_id:', data?.subscriptionId);
  return { success: true };
}
