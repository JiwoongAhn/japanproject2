/**
 * testData.js — E2E 테스트에서 사용하는 공통 테스트 데이터
 *
 * 실제 Supabase 테스트 계정 정보는 .env.test 에 보관하고
 * 여기서는 process.env로 참조하세요. (절대 하드코딩 금지)
 */

// ── 테스트 계정 ──────────────────────────────────────────────────────────────
const TEST_USER = {
  studentId:    process.env.E2E_STUDENT_ID    || 'TEST0001',
  password:     process.env.E2E_PASSWORD       || 'test-password',
  universityId: process.env.E2E_UNIVERSITY_ID  || 'kokushikan',
  universityName: '国士館大学',
};

// ── 과제 테스트 데이터 ────────────────────────────────────────────────────────
const TEST_ASSIGNMENT = {
  courseName: 'E2Eテスト科目',
  title:      'E2Eテスト課題',
  dueDate:    '20271231',  // formatDueDate가 '2027-12-31'로 변환
};

// ── 게시글 테스트 데이터 ──────────────────────────────────────────────────────
const TEST_POST = {
  title:    'E2Eテスト投稿タイトル',
  body:     'これはE2Eテスト用の投稿本文です。',
  category: 'free',
};

// ── 강의평가 테스트 데이터 ────────────────────────────────────────────────────
const TEST_REVIEW = {
  courseName: 'E2Eテスト講義',
  rating:     4,
  tag:        'わかりやすい',
  comment:    'E2Eテスト用のコメントです。',
};

// ── 수업 (시간표) 테스트 데이터 ──────────────────────────────────────────────
const TEST_COURSE = {
  name:   'E2Eテスト授業',
  day:    '月',   // 月〜金
  period: 1,
  room:   '1号館101',
};

module.exports = {
  TEST_USER,
  TEST_ASSIGNMENT,
  TEST_POST,
  TEST_REVIEW,
  TEST_COURSE,
};
