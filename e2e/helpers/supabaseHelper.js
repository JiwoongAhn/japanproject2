/**
 * supabaseHelper.js — 테스트용 DB 데이터 관리
 *
 * 역할:
 *  - 테스트 시작 전: 테스트 데이터를 DB에 삽입 (seed)
 *  - 테스트 종료 후: 테스트 데이터를 DB에서 삭제 (cleanup)
 *
 * 이렇게 해야 테스트가 실제 사용자 데이터에 영향을 주지 않습니다.
 *
 * 나중에 모바일로 전환해도 이 파일은 그대로 재사용 가능합니다.
 * (Supabase 연동은 플랫폼 무관)
 */

// Supabase admin 클라이언트는 service_role 키가 필요합니다.
// 환경변수: E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY
// (일반 anon 키로는 RLS 때문에 다른 유저 데이터 삭제 불가)

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

function getClient() {
  if (!supabase) {
    // TODO: @supabase/supabase-js 를 사용하는 admin 클라이언트 초기화
    // const { createClient } = require('@supabase/supabase-js');
    // supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  }
  return supabase;
}

/**
 * 테스트용 과제 데이터 삽입
 * @param {string} userId
 * @param {object} data  { course_name, title, due_date, status }
 */
async function seedAssignment(userId, data) {
  // TODO: 구현 필요
}

/**
 * 테스트용 게시글 데이터 삽입
 * @param {string} userId
 * @param {object} data  { title, body, category, is_anonymous }
 */
async function seedPost(userId, data) {
  // TODO: 구현 필요
}

/**
 * 테스트용 수업 데이터 삽입
 * @param {string} userId
 * @param {object} data  { name, day_of_week, period, room }
 */
async function seedCourse(userId, data) {
  // TODO: 구현 필요
}

/**
 * 특정 유저의 테스트 데이터 전체 삭제
 * @param {string} userId
 */
async function cleanupUser(userId) {
  // TODO: assignments, posts, courses, course_reviews 전부 삭제
}

module.exports = {
  seedAssignment,
  seedPost,
  seedCourse,
  cleanupUser,
};
