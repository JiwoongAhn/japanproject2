# 17개교 LMS 프로필 — 전 대학 지원 설계도

작성: 2026-09-18 (품질 트랙 Phase 3). 조사 방법 = **계정 없이** 공개 로그인 페이지·공식 사이트·`scripts/check-links.sh`(HTTP 생존)·`curl` 리다이렉트 추적. 실제 로그인·시간표 페이지 구조는 **그 학교 재학생 테스터가 생기면** 확인한다.

> 검증 등급: ✅ 실기 검증 / 🔎 공개 페이지로 확인 / ❓ 미확인(추정) / ❌ 불가

## 0. 한눈에 보기 — "학교별"이 아니라 **LMS 제품별**

| 제품 | 학교 | 우리 코드 상태 | 개통 지렛대 |
|---|---|---|---|
| **manaba** (朝日ネット) | 国士舘 ✅ / 東洋 🔎 / 大東文化 🔎 / 亜細亜 🔎 | 파서·쿠키유지·리마인더 메일 파이프라인 **완성** (国士舘 실증) | 파라미터화 완료(Phase 1). **SSO 3교는 재학생 1명이면 즉시 검증 가능** |
| **WebClass** (日本データパシフィック) | 神奈川 / 東京農業 / 東京都市 | 링크만 | 제품 파서 1개 = 3교 |
| **UNIPA / UNIVERSAL PASSPORT** (日本システム技術) | 東京電機(UNIPA) / 玉川(UNITAMA) / 日本文理(UPX) / 大阪国際(OIU UNIPA) | 링크만 | 제품 파서 1개 = 4교 |
| **CampusSquare / Campus-Xs** | 拓殖 / 亜細亜(포털) | 링크만 | 시라바스 검색 공개 |
| **Open LMS(Moodle)** | 東海 | 링크만 | Microsoft SSO |
| 자체·기타 | 日本(학부별 상이) / 駒澤 KONECO / 専修 教務Web / 帝京 LMS | 링크만 | 후순위 |

## 1. 학교별 상세

### 1-1. manaba 4교 (①로그인 유지 → ②시간표 → ③게시판 우선순위상 최우선)

| 학교 | LMS URL | 로그인 방식 | 세션/재로그인 | 리마인더 메일 발신 | 개통 난이도 |
|---|---|---|---|---|---|
| **国士舘** `kokushikan` | `kokushikan.manaba.jp` | 자체 ID/PW 폼 + kaede-i 자동재로그인 | ✅ 쿠키 7일 + 자동재로그인 | `@kokushikan.manaba.jp` ✅ | ✅ 운영 중 |
| **東洋** `toyo` | `www.ace.toyo.ac.jp` (ToyoNet-ACE = manaba **2.98**) 🔎 | `/ct/login` → **secioss SAML SSO**(`slink.secioss.com`) 리다이렉트. 같은 호스트에 `/local/login`(ID/PW 폼)도 존재 | ❓ SSO 세션 수명 미확인 | ❓ `@ace.toyo.ac.jp` 추정 → `ALLOWED_SENDERS`에 추가함(재학생 확인 필요) | 🟡 즉시 후보 — 재학생 1회 로그인 검증만 남음 |
| **大東文化** `daito` | `daito.manaba.jp` 🔎 | `/ct/login` → **Microsoft Entra(Azure AD) SAML** 리다이렉트 | ❓ MS 세션 = 보통 장기(KMSI) | `@daito.manaba.jp` → `manaba.jp` 계열로 이미 허용 ✅ | 🟡 즉시 후보 |
| **亜細亜** `asia-u` | `asia-u.manaba.jp` 🔎 | `/ct/login` → **ex-tic SAML IdP**(`asia.ex-tic.com`) 리다이렉트 | ❓ | `@asia-u.manaba.jp` → 허용 ✅ | 🟡 즉시 후보 |

**코드 대응 완료(2026-09-18):**
- `ManabaLoginScreen.isLoggedIn`이 `/ct/login`만 제외하던 것을 **`/login` 경로 전체 제외**로 일반화 — 東洋 `/local/login`을 로그인 완료로 오판하던 구멍 차단. SSO 리다이렉트 중(타 호스트)에는 호스트 비교로 자연히 대기.
- 東洋 `manabaUrl`을 `https://www.ace.toyo.ac.jp/ct/login`로 교정(기존 `ace.toyo.ac.jp`는 DNS 자체가 없었음).
- `mail-inbound/ALLOWED_SENDERS`에 `ace.toyo.ac.jp` 추가.

**재학생 테스터가 생기면 확인할 것(3교 공통, 10분):** ① 앱 → manaba 로그인 → SSO 통과 후 `/ct/home` 도달 ② 앱 완전 종료 → 재실행 시 로그인 유지 ③ 리마인더 설정 페이지(`/ct/home_preferences_reminder`)에 토큰 주소 등록 → 인증 메일의 **발신 도메인** 기록 ④ 공지 파싱 셀렉터(`.home-newsitem` / `table.stdlist`)가 그 학교 manaba 버전에서도 맞는지.

### 1-2. WebClass 3교

| 학교 | URL | 로그인 | 비고 |
|---|---|---|---|
| **神奈川** `kanagawa-u` | `kulms.kanagawa-u.ac.jp` 🔎 | WebClass 표준 로그인(폼) | 시라바스 `webstation-koukai.kanagawa-u.ac.jp` 공개 ✅ |
| **東京農業** `nodai` | `lms.nodai.ac.jp` 🔎 | WebClass 표준 | 시라바스 `ngp.nodai.ac.jp/portalv3/slbsscmr.do` 공개 ✅ |
| **東京都市** `tcu` | `webclass.tcu.ac.jp` 🔎 | WebClass 표준 | 시라바스 `websrv.tcu.ac.jp/tcu_web_v3/slbsskgr.do` 공개 ✅ |

WebClass는 시간표 페이지(`/webclass/` 내 時間割)와 공지(お知らせ)가 제품 공통 구조. **파서 1개로 3교** — 재학생 1명의 HTML 샘플이 있으면 착수 가능.

### 1-3. UNIPA 계열 4교

| 학교 | URL | 로그인 | 교시 | 비고 |
|---|---|---|---|---|
| **東京電機** `dendai` | `portal.sa.dendai.ac.jp/uprx/…`(DENDAI-UNIPA) 🔎 | UNIPA 폼(게스트 시라바스 있음) | ✅ **2026년도 공식 PDF 실측 반영** 1限9:20/2限11:05/3限13:45/4限15:30/5限17:15 (90분) | 조사 시점 503(점검?) — 재확인 |
| **玉川** `tamagawa` | `unitama.tamagawa.ac.jp`(UNITAMA=UNIPA) 🔎 + Blackboard(수업) | UNIPA 폼 | ❓ | 시라바스 `acweb01.adm.tamagawa.ac.jp`(http) 공개 |
| **日本文理** `nbu` | `www.nbu.ac.jp/upx-login.html` → UNIVERSAL PASSPORT 🔎 | UNIPA 폼 | ❓ | 시라바스 로그인 필요 |
| **大阪国際** `oiu` | `www6.oiu.ac.jp/share/htdocs/`(在学生ポータル) + OIU UNIPA | Google 계정(`학번@oiu.jp`) 로그인 🔎 | ❓ 공개 자료 없음(국사관 기본값 사용 중) | `www6.oiu.ac.jp`는 **해외 IP에서 무응답**(DNS는 있음) — 일본 내 재확인 필요 |

UNIPA는 `/uprx/up/pk/pky501/…` 경로 체계가 제품 공통. 시간표(`時間割表`) 화면도 공통 → **파서 1개 = 4교**.

### 1-4. 나머지

| 학교 | 시스템 | 상태 |
|---|---|---|
| **日本** `nihon-u` | 학부별 완전 상이 | ❌ 단일 URL 불가 — 홈페이지만 |
| **駒澤** `komazawa-u` | KONECO(자체) `koneco.komazawa-u.ac.jp` 🔎 | 후순위 |
| **専修** `senshu-u` | 教務Webサービス `ris.acc.senshu-u.ac.jp` | 조사 시점 502(일시 장애로 보임) — 재확인 |
| **帝京** `teikyo-u` | `lms2017.teikyo-u.ac.jp`(ID/PW 폼) 🔎 / 시라바스 `activeacademy.ita.teikyo-u.ac.jp`(板橋) | 시라바스 호스트가 **해외 IP 무응답**(DNS 있음) — 일본 내 재확인 |
| **東海** `tokai` | Open LMS `tlms.tsc.u-tokai.ac.jp` 🔎 → **Microsoft SSO** | URL 교정 완료(구 `lms.u-tokai.ac.jp` DNS 소멸). 시라바스 구주소 사망 → 빈값 |
| **拓殖** `takushoku-u` | CampusSquare `portal.takushoku-u.ac.jp/campusweb`(폼) 🔎 | 시라바스 공개 ✅ |

## 2. 링크 생존 검사 결과 (2026-09-18)

`bash scripts/check-links.sh --dead` — 교정 전 **49개 중 8개 문제 → 교정 후 47개 중 4개**.

| 교정 | 내용 |
|---|---|
| ✅ 교체 | 東洋 manaba `ace.toyo.ac.jp`→`www.ace.toyo.ac.jp/ct/login` / 東海 LMS `lms.`→`tlms.tsc.` / 亜細亜 시라바스 `portal.`→`cx.` |
| ✅ 제거(빈값=버튼 자동 숨김) | 国士舘 `portalUrl`(DNS 소멸, kaede-i가 대체) / 東海 시라바스(호스트 사망) |
| ⏳ 유지·재확인 | 専修 LMS 502 / 東京電機 UNIPA 503 (일시 장애 추정) / 帝京 시라바스·大阪国際 포털 = 해외 IP 무응답 추정 → **일본 내 네트워크(또는 실기)에서 재확인** |

## 3. 다음 단계 (우선순위 = 사용자 지정 ①로그인 유지 → ②시간표 → ③게시판)

1. **manaba SSO 3교 실증** — 東洋·大東·亜細亜 재학생 1명씩. 위 §1-1 체크 4항목. 통과하면 `docs`의 🔎→✅ 갱신 + 발신 도메인 확정.
2. **WebClass 파서**(3교) — 재학생 HTML 샘플 확보 후 `timetableRouter.DEDICATED`에 `webclass` 추가.
3. **UNIPA 파서**(4교) — 동일. 東京電機는 교시까지 확정돼 있어 첫 후보.
4. 大阪国際 교시(`periodRanges`) — 학생편람/재학생 확인 후 추가.
5. 정기 점검: `bash scripts/check-links.sh --dead`를 학기 시작 전 1회.
