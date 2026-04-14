/**
 * home.spec.js — 홈 화면 E2E 테스트
 *
 * 커버하는 시나리오:
 *  H-1: 로그인 후 홈 화면 4개 섹션이 모두 표시된다
 */

const { test } = require('../../fixtures/auth.fixture');
const { expect } = require('@playwright/test');
const { HomePage } = require('../../pages/home/HomePage');

test.describe('홈 화면', () => {
  test('H-1: 홈 화면에 4개 섹션(오늘 수업, 마감 임박 과제, 게시판, 학교 정보)이 모두 표시된다', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const home = new HomePage(page);

    // 홈 탭으로 이동
    await home.goToHomeTab();

    // 4개 섹션 헤더 모두 확인
    await expect(page.getByText('今日の授業').first()).toBeVisible();
    await expect(page.getByText('締切が近い課題').first()).toBeVisible();
    await expect(page.getByText('掲示板').first()).toBeVisible();
    await expect(page.getByText('学校情報').first()).toBeVisible();
  });
});
