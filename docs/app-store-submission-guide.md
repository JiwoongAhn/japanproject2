# App Store 제출 가이드 (Unipas) — 초보자용 단계별

> 이 문서는 "어디에 무엇을 넣는지" 순서 안내입니다. 실제 입력 내용은
> `app-store-listing.md`(설명문), `app-store-privacy.md`(개인정보), `app-store-review-notes.md`(리뷰노트) 참조.

## 사전 준비 (계정)
- [ ] **Apple Developer Program 가입** (연 $99). developer.apple.com → Enroll. 개인/법인 선택. 가입 승인까지 보통 1~2일.
- [ ] App Store Connect(appstoreconnect.apple.com) 로그인 가능 확인.

## Step 1. 앱 생성 (App Store Connect)
1. App Store Connect → **My Apps → ＋ → New App**
2. 입력:
   - Platform: **iOS**
   - Name: **Unipas** (이미 다른 곳에서 선점됐다면 `Unipas - 大学生活` 등으로)
   - Primary Language: **Japanese**
   - Bundle ID: **com.jiwoongahn.unipas** (목록에 없으면 Developer 사이트에서 Identifier 먼저 등록)
   - SKU: 아무 고유값 (예: `unipas-ios-001`)

## Step 2. 스토어 등록 정보 입력 (`app-store-listing.md` 사용)
- [ ] 서브타이틀 / 프로모션 텍스트 / 설명 / 키워드
- [ ] Support URL(`https://unipas.app`), Privacy Policy URL(`https://privacy.unipas.app` ✅완료)
- [ ] 카테고리: 教育(Education)

## Step 3. 스크린샷 (항목 E)
- [ ] 6.7형(필수, 1290×2796) — 시뮬레이터(iPhone 17 등)에서 `Cmd+S`로 캡처
- 권장 화면: 홈 / 시간표 / 게시판 / 授業レビュー / マイページ (4~6장)
- (선택) 6.5형·5.5형도 있으면 더 좋음

## Step 4. App Privacy (`app-store-privacy.md` 사용)
- [ ] 좌측 **App Privacy → Get Started**
- [ ] 수집 데이터 5종 입력(이메일/User ID/Device ID/사진/기타 콘텐츠), 전부 **추적=No / 목적=App Functionality**
- [ ] Privacy Policy URL 입력(동일)

## Step 5. 연령 등급 (Age Rating)
- [ ] 설문에서 **User-Generated Content = Yes** (익명 게시판 있음) → 통상 **17+**
- [ ] 통보/차단/필터 있음을 근거로 정직하게 답변 (없다고 하면 추후 문제)
- [ ] "Unrestricted Web Access"는 일반 웹브라우저가 아니므로 **No** (특정 학교 사이트만 인앱 표시)

## Step 6. App Review Information (`app-store-review-notes.md` 사용) ★중요
- [ ] **Sign-in required = Yes**
- [ ] 데모 계정: 国士舘大学 → `appreview@kokushikan.ac.jp` → 코드 `482915`
- [ ] Notes 칸에 영문 리뷰노트 붙여넣기 (데모 로그인 절차 + 학교시스템 설명 + UGC 모더레이션)
- [ ] 연락처 이메일/전화

## Step 7. 빌드 업로드 (EAS)
> 사진 권한 등 최신 `app.json`이 반영된 **새 프로덕션 빌드**가 필요합니다.
```bash
cd /Users/jiwoong/claudeproject/japanproject
# 프로덕션 빌드 (Apple 계정/인증서 설정은 안내에 따라 진행)
eas build --platform ios --profile production
# 빌드 완료 후 App Store Connect로 제출
eas submit --platform ios --profile production
```
- [ ] 업로드된 빌드를 App Store Connect 버전 화면에서 **Build** 로 선택

## Step 8. 제출
- [ ] 모든 항목 녹색 체크 확인 → **Add for Review → Submit**
- [ ] 심사 보통 1~3일. 리젝 시 사유 확인 후 대응.

---

## 제출 전 최종 체크리스트
- [ ] 1. 사진 권한 문자열(app.json) ✅ 완료 — **단, 새 빌드에 반영되려면 재빌드 필요**
- [ ] 2. 데모 계정 + 리뷰노트 ✅ 완료
- [ ] 3. 설명문/키워드 ✅ 초안 (확정 필요)
- [ ] 4. App Privacy 표 ✅ 완료
- [x] C. **Privacy Policy 공개 URL** ✅ 완료 → `https://privacy.unipas.app` (Cloudflare, 2026-06-14)
- [ ] E. **스크린샷** ❌ 미완
- [ ] 학교 이용약관 법무 검토(별도 리스크)
