# 항목 C(개인정보처리방침 공개 URL) · E(스크린샷) 준비

## C. 개인정보처리방침 공개 URL

준비됨: `web/privacy.html` (앱 내 정책과 동일 내용, 단일 파일).

### 호스팅 방법 (택1) — `unipas.app`은 Cloudflare 보유
**방법 1 (추천·가장 쉬움): Cloudflare Pages 드래그 업로드**
1. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Upload assets**
2. 프로젝트 이름 예: `unipas-privacy`
3. `web/` 폴더(또는 `privacy.html`)를 업로드. 단, 진입 파일명을 `index.html`로 두면 루트에서 열림 → **업로드 시 `privacy.html`을 `index.html`로 바꿔 올리는 걸 권장**
4. 배포되면 `https://unipas-privacy.pages.dev` URL 생성
5. (선택) Custom domain → `privacy.unipas.app` 연결
6. → 이 URL을 App Store Connect의 **Privacy Policy URL** 및 `app-store-listing.md`에 기입

**방법 2: 기존 도메인 라우트 `https://unipas.app/privacy`**
- Cloudflare Pages 프로젝트에 `unipas.app` 커스텀 도메인 연결 + 파일명 `privacy.html` → `https://unipas.app/privacy.html`

> 다음 세션에서 "C 진행하자" 하면: 위 1~6 중 막히는 지점을 짚어주거나, 파일명/메타 조정을 도와줌.

---

## E. 스크린샷

App Store는 **6.7형(필수)** 스크린샷이 필요. 데모 계정으로 로그인하면 화면이 채워져 있어 캡처에 좋음.

### 캡처 방법
1. 시뮬레이터를 **iPhone 16/17 Pro Max 계열(6.7형, 1290×2796)** 로 실행
2. 데모 로그인: 国士舘大学 → `appreview@kokushikan.ac.jp` → `482915`
3. 각 화면에서 시뮬레이터 메뉴 **File → Save Screen** 또는 `Cmd+S` (바탕화면 저장)

### 권장 4~6장 (순서 = 스토어 노출 순서)
- [ ] **홈**(今日のまとめ + 게시판 미리보기)
- [ ] **時間割**(샘플 시간표 3개 보임)
- [ ] **掲示板**(글 목록)
- [ ] **授業レビュー** 또는 課題
- [ ] **マイページ**(프로필 + 설정)

### 팁
- 상태바 시간/배터리 깔끔하게: 시뮬레이터 `xcrun simctl status_bar` 로 정리 가능(선택).
- 6.5형(1242×2688)도 있으면 더 좋지만 6.7형만 있어도 제출 가능.

> 다음 세션에서 "E 진행하자" 하면: 캡처 규격 맞추기, 필요 시 프레임/문구 합성 안내.
