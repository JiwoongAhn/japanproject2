/**
 * supabaseHelper.js — E2E 테스트용 Supabase Admin 헬퍼
 *
 * Service Role Key로 테스트 계정을 관리하고 세션 토큰을 발급합니다.
 * magic link 방식 대신 signInWithPassword를 사용해 redirect URL 화이트리스트 불필요.
 *
 * 필요한 환경변수 (.env):
 *   E2E_SUPABASE_SERVICE_ROLE_KEY  — Supabase 대시보드 > Settings > API > service_role
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY  — 이미 설정되어 있음
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rexnpusrxezuztxmkaex.supabase.co';
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

const TEST_USER_EMAIL    = 'e2etest@kokushikan.ac.jp';
const TEST_USER_PASSWORD = 'Unipas-E2E-2024!';
const TEST_UNIVERSITY    = '国士館大学';
const TEST_NICKNAME      = 'e2eテスター';

function getAdminClient() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      'E2E_SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.\n' +
      '.env 파일에 E2E_SUPABASE_SERVICE_ROLE_KEY=... 를 추가하세요.'
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * 테스트 유저 + 프로필 확보 (없으면 생성, 있으면 비밀번호 동기화)
 */
async function ensureTestUser() {
  const admin = getAdminClient();

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let userId;
  const existing = users.find(u => u.email === TEST_USER_EMAIL);

  if (existing) {
    userId = existing.id;
    // 비밀번호가 설정되지 않았을 수 있으므로 항상 동기화
    await admin.auth.admin.updateUserById(userId, {
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data: { user }, error } = await admin.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser 실패: ${error.message}`);
    userId = user.id;
  }

  // 프로필 upsert — nickname이 있어야 AcEmailInput 화면이 뜨지 않음
  // (AppNavigator: profile !== null && !profile.nickname → needsNickname = true)
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    university: TEST_UNIVERSITY,
    nickname: TEST_NICKNAME,
    school_email: TEST_USER_EMAIL,
  }, { onConflict: 'id' });
  if (profileError) throw new Error(`profiles upsert 실패: ${profileError.message}`);

  return userId;
}

/**
 * 테스트 세션 발급 (access_token, refresh_token 반환)
 * signInWithPassword를 사용하므로 redirect URL 화이트리스트 불필요
 */
async function getTestSession() {
  await ensureTestUser();

  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!ANON_KEY) throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY 환경변수가 없습니다.');

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { session }, error } = await anonClient.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (error) throw new Error(`signInWithPassword 실패: ${error.message}`);

  return session;
}

/**
 * 특정 유저의 테스트 데이터 전체 삭제
 * @param {string} userId
 */
async function cleanupUser(userId) {
  const admin = getAdminClient();
  await admin.from('post_comments').delete().eq('user_id', userId);
  await admin.from('post_likes').delete().eq('user_id', userId);
  await admin.from('posts').delete().eq('user_id', userId);
  await admin.from('assignments').delete().eq('user_id', userId);
  await admin.from('courses').delete().eq('user_id', userId);
  await admin.from('course_reviews').delete().eq('user_id', userId);
}

module.exports = {
  getTestSession,
  cleanupUser,
  TEST_USER_EMAIL,
  TEST_UNIVERSITY,
  TEST_NICKNAME,
};
