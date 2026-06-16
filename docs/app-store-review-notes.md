# App Store Connect — App Review Notes (UniOne)

> App Store Connect → 앱 버전 → **App Review Information → Notes** 에 아래 영문을 붙여넣기.
> **Demo 로그인**: 국사관대학(国士舘大学) 선택 → 이메일 `appreview@kokushikan.ac.jp` → 코드 `482915`.
> (코드는 Supabase Secret `DEMO_OTP_CODE` 와 일치해야 함. 바꾸면 양쪽 다 변경.)

---

## 붙여넣을 영문 (Review Notes)

```
== Demo Account (please use this to sign in) ==
This app is gated by school-email verification. Normal users receive a one-time
code at their university email. For App Review we provide a demo account that
bypasses email delivery:

1. On the first screen, tap through the privacy policy consent (scroll to the
   bottom, check the box, tap "同意して始める").
2. Select university: 国士舘大学 (Kokushikan University).
3. Email: appreview@kokushikan.ac.jp
4. Tap to send code, then on the next screen enter code: 482915
5. You will be logged into a demo account with sample timetable and a sample post.

== About this app ==
UniOne is a campus-life app for Japanese university students (timetable,
assignments, an anonymous student board, and course reviews).

== School system access (transparency) ==
Some features open the student's own school portal (kaede / manaba) inside an
in-app WebView using the STUDENT'S OWN credentials. We are an independent,
unofficial app and are not affiliated with the universities. Passwords are never
stored on our servers (kaede credentials are stored only on-device with AES-256;
manaba uses session cookies). The demo account does not have these connected.

== User-generated content moderation (Guideline 1.2) ==
The board supports reporting posts/comments/reviews, blocking users, a profanity
filter on posting, and automatic hiding of content reported by 3+ distinct users.

== Privacy / Tracking ==
No third-party analytics, advertising, or tracking SDKs are used (no ATT prompt).
Data is used only for app functionality. Privacy policy is shown on first launch
and in My Page.
```

---

## 한국어 메모 (우리만 보는 설명)
- 데모 로그인은 `demo-login` Edge Function이 처리 (이메일+코드 일치 시 magiclink 토큰 발급 → 클라이언트 verifyOtp). 메일 발송 없음.
- 데모 계정은 国士舘大学 소속이라 리뷰어가 国士舘 게시판(실제 사용자 글 포함)을 보게 됨 — 일반 학생과 동일한 뷰라 문제 없음.
- 앱 업데이트 재심사에도 같은 계정/코드 재사용 가능.
- 코드 변경 시: ① Supabase Secret `DEMO_OTP_CODE` ② 이 문서 ③ App Store Connect Notes 세 곳을 함께 수정.
