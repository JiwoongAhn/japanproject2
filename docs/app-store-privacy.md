# App Store Connect — App Privacy 공개표 (UniOne)

> 작성 2026-06-14. 코드/DB 스키마 기준. App Store Connect → 앱 → **App Privacy(앱 개인정보 보호)** 에 그대로 입력.
> 모든 항목 공통: **추적(Tracking)에 사용 = いいえ/No** (서드파티 분석·광고·추적 SDK 미사용 → ATT 동의창 불필요).

## 1. 수집하는 데이터 (Data Collected)

| Apple 데이터 유형 | 구체 항목(우리 앱) | 용도(Purpose) | 사용자 식별과 연결? | 추적? |
|---|---|---|---|---|
| **Contact Info → Email Address** | 학교 이메일(`@***.ac.jp`) | App Functionality (계정 인증·재학 확인) | 예 | 아니오 |
| **Identifiers → User ID** | 계정 ID(Supabase), 닉네임 | App Functionality | 예 | 아니오 |
| **Identifiers → Device ID** | Expo 푸시 토큰 | App Functionality (푸시 알림 전송) | 예 | 아니오 |
| **User Content → Photos or Videos** | 게시판 첨부 사진 | App Functionality | 예 | 아니오 |
| **User Content → Other User Content** | 시간표(과목·교수·메모), 과제, 게시글·댓글, 수업평가, manaba 통지 내용 | App Functionality | 예 | 아니오 |

- 출처 테이블: `profiles`(이메일·닉네임·대학) / `push_tokens`(토큰) / `posts`·`post_comments`·`course_reviews`·`courses`·`assignments`·`manaba_notices`(사용자 콘텐츠) / `post-images` 버킷(사진).
- 신고·차단(`*_reports`, `user_blocks`)은 위 User ID/User Content 범주에 포함되어 별도 신고 불필요.

## 2. 수집하지 않는 데이터 (명시적 "No")

위치, 연락처(주소록), 건강·피트니스, 금융정보, 검색/브라우징 기록, **사용 데이터(분석)**, **진단(크래시/성능)**, 민감정보.
→ 서드파티 분석/광고/크래시 SDK 미설치. 위치 권한 미사용.

## 3. App Store Connect 입력 시 각 항목 답변 순서
각 데이터 유형마다 Apple이 3가지를 물음:
1. **이 데이터를 추적에 사용?** → 전부 **아니오**
2. **사용자 신원과 연결?** → 전부 **예** (계정에 귀속)
3. **목적?** → 전부 **앱 기능(App Functionality)** 만 체크 (분석/광고/제3자 공유 체크 안 함)

## 4. ⚠️ 관련 발견 — 제출 전 점검 필요 (별도 항목)
- **사진 권한 사용설명 문자열 누락 가능**: `expo-image-picker`를 쓰는데 `app.json`의 `plugins`/`ios.infoPlist`에 `NSPhotoLibraryUsageDescription`(사진 접근 이유 안내문)이 안 보임. iOS는 이 문자열이 없으면 사진 접근 시 크래시 또는 심사 리젝 가능 → 제출 전 추가 권장. (예: `"NSPhotoLibraryUsageDescription": "投稿に画像を添付するために写真へのアクセスを許可してください"`)
- 입력한 App Privacy는 **앱 내 개인정보처리방침 화면(PrivacyPolicyBody)과 내용이 일치**해야 함 — 현재 정책 문구와 위 표는 정합.
