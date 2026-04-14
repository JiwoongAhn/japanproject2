/**
 * community.spec.js — 게시판 E2E 테스트
 *
 * 커버하는 시나리오:
 *  C-4: 게시글 작성 폼 입력 → 게시판 목록으로 돌아옴
 */

const { test } = require('../../fixtures/auth.fixture');
const { expect } = require('@playwright/test');
const { PostListPage } = require('../../pages/community/PostListPage');
const { PostCreatePage } = require('../../pages/community/PostCreatePage');
const { TEST_POST } = require('../../fixtures/testData');

test.describe('게시판', () => {
  test('C-4: 게시글 작성 후 제출하면 게시판 목록으로 돌아온다', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const postList = new PostListPage(page);
    const postCreate = new PostCreatePage(page);

    // 게시판 탭으로 이동
    await postList.goCommunityTab();

    // 게시글 작성 버튼 클릭
    await postList.clickCreatePost();

    // 게시글 작성 화면 열림 확인 (제목 입력창으로 판단)
    await expect(page.getByPlaceholder('タイトルを入力してください')).toBeVisible({ timeout: 5000 });

    // 카테고리 선택 (フリー)
    await postCreate.selectCategory('フリー');

    // 제목 입력
    await postCreate.fillTitle(TEST_POST.title);

    // 본문 입력
    await postCreate.fillBody(TEST_POST.body);

    // Alert 처리 준비 (에러 발생 시)
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    // 제출
    await postCreate.submit();

    // 게시판 목록으로 돌아옴 확인 — Supabase insert 완료 후 navigation.goBack() 대기
    await expect(page.getByPlaceholder('タイトルを入力してください')).not.toBeVisible({ timeout: 15000 });

    // 게시판 목록 화면으로 돌아왔는지 확인
    await expect(page.getByText('掲示板').first()).toBeVisible({ timeout: 5000 });
  });
});
