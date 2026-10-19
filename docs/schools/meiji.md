# 明治大学 `meiji` — 역할 지도

> 작성 2026-10-19. 양식 = `docs/schools/_template.md`.
> 검증 등급: ✅ 재학생 실기 / 🔎 공개 자료(원문 직접 확인) / 💬 재학생 제보 / ❓ 추정
> ⚠️ 1차 조사(같은 날) 오류 2건을 공식 원문으로 정정함 — §4 참고. 다음 수정 때 근거 URL 부터 다시 열어볼 것.

## 0. 요약
- 실사용자 수: 0명 (2026-10-19 추가)
- 이용규정 등급: ⚪ 미확인 (비공식 앱 금지 공지 못 찾음) → `docs/university-tos-review.md`
- 자동 로그인: — (OFF. 학외 2단계 인증 필수 + 대학이 비밀번호 공유 금지 안내)
- 시간표 一括: AI 읽기 (教務システム / 스크린샷 / 붙여넣기)

## 1. 역할 지도

| 역할 | 시스템 | 제품 | 진입 URL | 로그인 | 근거 | 등급 |
|---|---|---|---|---|---|---|
| 시간표 | 明治大学 教務システム | **Campus-Xs** (亜細亜와 같은 계열) | `meiji-kyomu.mind.meiji.ac.jp/campusweb/top.do` | 「共通認証はこちら」→ Meiji ID(학외 2단계 인증) | 로그인 화면 문구 「学生は共通認証でログインしてください」, [教務システムのご案内](https://www.meiji.ac.jp/koho/edu/mkmht000001mdtsa.html) 「履修成績のMy時間割メニューから確認」 | 🔎 |
| 성적 | 教務システム | 同上 | 同上 | 同上 | 同上(成績の確認) | 🔎 |
| 과제·수업 | Oh-o! Meiji (2025 리뉴얼) | 자체 | `www.oh-o.meiji.ac.jp` → `/saml/login` → `sso.meiji.ac.jp` | Meiji ID + 학외 MFA | curl 실측(302→/login, SAML), [認証手順](https://www.meiji.ac.jp/isc/id/oho-meiji_auth.html) | 🔎 |
| 메일 | Meiji Mail | Microsoft 365 | — | — | [Meiji Mail](https://www.meiji.ac.jp/ksys/it/mail.html) 「7～8桁の英数字@meiji.ac.jp」 | 🔎 |
| 시라바스 | ❓ | | | | 공개 주소 미확인 | ❓ |

## 2. 앱 설정값과 근거 (확인일 2026-10-19)

| 설정 | 값 | 근거 |
|---|---|---|
| emailDomain | `meiji.ac.jp` | Meiji Mail 원문. ⚠️ `学生番号@meiji.ac.jp` 는 **Meiji ID(로그인용)** 이라 메일이 안 온다 ([アカウント一覧](https://www.meiji.ac.jp/isc/id/account.html)) → 학생이 이 주소를 넣으면 인증코드를 못 받는다 |
| location | 東京都千代田区 | [キャンパス案内](https://www.meiji.ac.jp/koho/campus_guide/) 駿河台 = 千代田区神田駿河台1-1 |
| campuses | 駿河台 / 和泉(杉並区) / 生田(川崎市多摩区) / 中野(中野区) | 同上 |
| periodRanges | 1限 9:00–10:40 / 2限 10:50–12:30 / 3限 13:30–15:10 / 4限 15:20–17:00 / 5限 17:10–18:50 / 6限 19:00–20:40 | [経営学部 時限表](https://www.meiji.ac.jp/keiei/curriculum/time_schedule.html), [政治経済学部 4キャンパス共通表](https://www.meiji.ac.jp/seikei/student/news.html) (각 時限 a/b 50분 모듈 = 합쳐서 100분) |
| aiTimetableUrl | 教務システム top.do | 위 시간표 행 |
| lmsUrl | `www.oh-o.meiji.ac.jp` | 旧 `oh-o2.meiji.ac.jp` 는 「2024年度以前の授業」용 (로그인 화면 링크 문구) |

## 3. 학생이 써 봐야 확인되는 것 (❓)
- [ ] 앱 안 브라우저에서 共通認証 + 학외 2단계 인증이 통과되는지
- [ ] 메뉴 이름이 실제로 「履修成績 → My時間割」인지 (공식 안내 문구 기준, 화면 미확인)
- [ ] My時間割 페이지에서 「時間割を読み取る」 결과 (Campus-Xs 표 구조)
- [ ] OTP 메일(`noreply@unipas.app`)이 Meiji Mail(Microsoft 365) 정크로 가지 않는지

## 4. 정정 기록
| 1차 조사 | 문제 | 정정 |
|---|---|---|
| 시간표 = Oh-o! Meiji 「クラスウェブ → 時間割」 | 검색 요약이 **旧 Oh-o! Meiji 도움말**(oh-o2, 지금 DNS 없음) | 教務システム 「履修成績 → My時間割」 |
| 교시 근거 = `laws/curriculum/jikantai.html` | **법과대학원** 페이지 (값은 같음) | 학부 페이지 2곳으로 교체 |

## 5. 참고 (🟡)
- 대학이 학생에게 「個人情報を生成系AIに入力しない」 주의 ([学長メッセージ 2023](https://www.meiji.ac.jp/gakucho/message/20230517_generative-ai.html)). 앱은 동의 후 본인 시간표만 보내고 저장·학습 없음. 꺼리는 학생은 「＋追加」 수동 입력
