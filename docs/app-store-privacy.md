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
| **Identifiers → User ID** (추가) | manaba 알림 전달용 앱 발급 주소(`{토큰}@unipas.app`) | App Functionality (학교 알림 → 푸시) | 예 | 아니오 |

- 출처 테이블: `profiles`(이메일·닉네임·대학) / `push_tokens`(토큰) / `posts`·`post_comments`·`course_reviews`·`courses`·`assignments`·`manaba_notices`(사용자 콘텐츠) / `mail_subscriptions`(알림 전달 토큰 주소) / `push_delivery_logs`(푸시 전송 로그, 내부 운영용) / `post-images` 버킷(사진).
- 신고·차단(`*_reports`, `user_blocks`)은 위 User ID/User Content 범주에 포함되어 별도 신고 불필요.

### 마나바 알림→푸시 데이터 흐름 (2026-07 추가 기능)
- 학생별 고유 전달주소 `{토큰}@unipas.app`를 발급 → 학생이 manaba 리마인더 설정에 등록 → manaba **알림 메일만** 우리 서버(Cloudflare Email Routing)로 도착 → 파싱해 앱 푸시 발송.
- **비밀번호·학교 로그인 자격증명은 서버에 저장/전송하지 않음** (manaba 로그인은 앱 내 WebView, kaede ID/PW는 기기 내 AES-256 저장). 수신 대상은 학교 알림 메일에 한정.

## 2. 수집하지 않는 데이터 (명시적 "No")

위치, 연락처(주소록), 건강·피트니스, 금융정보, 검색/브라우징 기록, **사용 데이터(분석)**, **진단(크래시/성능)**, 민감정보.
→ 서드파티 분석/광고/크래시 SDK 미설치. 위치 권한 미사용.

## 3. App Store Connect 입력 시 각 항목 답변 순서
각 데이터 유형마다 Apple이 3가지를 물음:
1. **이 데이터를 추적에 사용?** → 전부 **아니오**
2. **사용자 신원과 연결?** → 전부 **예** (계정에 귀속)
3. **목적?** → 전부 **앱 기능(App Functionality)** 만 체크 (분석/광고/제3자 공유 체크 안 함)

## 4. 제출 전 점검 항목
- ✅ **사진 권한 문자열 해결됨** (2026-07-09 확인): `app.json` → `ios.infoPlist.NSPhotoLibraryUsageDescription` = `"投稿に画像を添付するために、写真ライブラリへのアクセスを許可してください。"` 존재.
- 입력한 App Privacy는 **앱 내 개인정보처리방침 화면(PrivacyPolicyBody)과 내용이 일치**해야 함 — 위 표 기준.
- ✅ **PrivacyPolicyBody 갱신 완료**(2026-07-09): 앱 내 정책 화면 §5 "利用するサービス"에 **Resend(인증코드 메일)·Cloudflare(manaba 통지 메일 전달)** 를 업무 위탁처(제3자 제공 아님)로 추가. manaba 통지 메일만 수신·해석하며 학교 비밀번호 서버 미저장 문구도 명시. 최종 갱신일 2026年7月9日로 변경.
