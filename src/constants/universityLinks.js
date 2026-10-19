// 대학별 링크 정보 (manaba, 홈페이지 등)
// HomeScreen의 학교정보 그리드에서 .filter(item => item.url)로 빈 문자열('')은 자동 숨김
// syllabusUrl이 있으면 시간표 화면에 シラバスボタン 표시
//
// 필드 설명
//   homepageUrl   필수. 외부 브라우저로 연다
//   manabaUrl     manaba 로그인 URL (manaba 학교만). 있으면 お知らせ 자동취득·리마인더 기능 활성
//   lmsUrl/lmsLabel   manaba 미사용 학교의 LMS (쌍으로). 앱 내 브라우저(쿠키 유지)로 연다
//   portalUrl/portalLabel  학사 포털 (쌍으로). 국사관 kaede-i 등. 앱 내 브라우저로 연다
//   timetableUrl  一括取り込み 전용 파서가 있는 학교만 (현재 국사관 kaede-i). 있으면 기존 kaede 자동 추출, AI 읽기는 쓰지 않는다
//   aiTimetableUrl   전용 파서가 없는 학교의 「大学のサイトから読み取る」 시작 주소 = 시간표가 있는 학무 시스템
//                    (LMS 가 아님에 주의 — 근거·등급은 docs/university-lms-profiles.md §4). 없으면 그 선택지만 숨김
//   aiTimetableLabel 그 시스템의 이름 (선택 시트에 「○○を開きます」로 표시)
//   aiTimetableGuide 학교 사이트 위쪽 안내 띠에 보일 時間割까지의 메뉴 경로 (일본어). 재학생 미확인이면 일반 문구
//   autoLoginHosts  ID/PW 기기 저장 + 자동입력을 허용하는 로그인 폼 호스트 목록.
//                   SSO 학교는 IdP 호스트를 명시. 없거나 빈 배열 = 쿠키 영속만(자동입력 없음).
//                   ⚠️ 오타로 엉뚱한 사이트에 비밀번호가 들어가지 않도록 테스트가 형식·소속을 검증한다.
//                   ⚠️ **실기 검증(재학생 실제 로그인)을 마친 학교만** 넣는다. 기본값은 OFF (2026-10-14 방침)
//   autoLoginCandidates  공개 로그인 페이지 폼 구조만 확인된 호스트(검증 대기). 앱은 읽지 않는다.
//                   재학생 실기 확인 후 autoLoginHosts 로 옮기면 켜진다
//   autoLoginBlocked  학교가 비공식 앱의 ID/PW 입력에 공식 반대 → 자동입력 금지(사유 문자열).
//                   이 값이 있으면 autoLoginHosts 를 넣을 수 없다(테스트가 막음). 근거 = docs/university-tos-review.md
export const universityLinks = {

  // ── 국사관대학 ────────────────────────────────────────────────────────────
  kokushikan: {
    homepageUrl: 'https://www.kokushikan.ac.jp',
    manabaUrl:   'https://kokushikan.manaba.jp/ct/login',
    portalUrl:   'https://kaedei.kokushikan.ac.jp', // 학사 포털 kaede-i (portal.kokushikan.ac.jp 는 DNS 소멸, 2026-09 확인)
    portalLabel: 'kaede-i',
    timetableUrl:'https://kaedei.kokushikan.ac.jp/Main/MyTimeTable.aspx', // 一括取り込み: 로그인 후 ReturnUrl로 자동 복귀
    syllabusUrl: 'https://kaedei.kokushikan.ac.jp/Syllabus/Top.aspx',
    // manaba 자체 ID/PW 폼 + kaede-i 폼 모두 자동입력 (2026-09-18 실기 검증)
    autoLoginHosts: ['kokushikan.manaba.jp', 'kaedei.kokushikan.ac.jp'],
  },

  // ── 배치 1 ────────────────────────────────────────────────────────────────
  'nihon-u': {
    homepageUrl: 'https://www.nihon-u.ac.jp',
    manabaUrl:   '', // 학부별 LMS 완전 상이 — 단일 URL 불가로 LMS 버튼 생략 (ホームページ만 제공)
    syllabusUrl: '', // 학부별 URL 상이 — 일괄 제공 불가
    portalUrl:   '',
  },
  toyo: {
    homepageUrl: 'https://www.toyo.ac.jp',
    aiTimetableUrl:   'https://g-sys.toyo.ac.jp/portal/', // AI 시간표 읽기 시작점: ToyoNet-G (secioss SSO)
    aiTimetableLabel: 'ToyoNet-G',
    manabaUrl:   'https://www.ace.toyo.ac.jp/ct/login', // ToyoNet-ACE = manaba 2.98 (www. 필수, ace.toyo.ac.jp 는 DNS 없음). 로그인은 secioss SAML SSO 로 리다이렉트
    // secioss IdP 폼: 맨 앞 display:none dummy 칸 + username + password (2026-09-20 curl 실측, 스크립트가 함정 칸 회피)
    // www.ace.toyo.ac.jp 는 /local/login 자체 폼(manaba 표준 폼으로 추정, 미실측) 대비
    autoLoginCandidates: ['slink.secioss.com', 'www.ace.toyo.ac.jp'],
    syllabusUrl: 'https://g-sys.toyo.ac.jp/syllabus/',
    portalUrl:   '',
  },
  'komazawa-u': {
    homepageUrl: 'https://www.komazawa-u.ac.jp',
    aiTimetableUrl:   'https://koneco.komazawa-u.ac.jp/', // AI 시간표 읽기 시작점: KONECO
    aiTimetableLabel: 'KONECO',
    aiTimetableGuide: '【履修】',
    manabaUrl:   '', // KONECO 자체 LMS 사용
    lmsUrl:      'https://koneco.komazawa-u.ac.jp/',
    lmsLabel:    'KONECO',
    autoLoginCandidates: ['koneco.komazawa-u.ac.jp'], // Drupal 폼(text+password+image 버튼) 2026-09-20 curl 실측
    autoLoginBlocked: '2020-04 時間割アプリへのKOMAnet ID/PW入力に注意喚起',
    syllabusUrl: 'https://koneco.komazawa-u.ac.jp/',
    portalUrl:   '',
  },
  'senshu-u': {
    homepageUrl: 'https://www.senshu-u.ac.jp',
    aiTimetableUrl:   'https://ris.acc.senshu-u.ac.jp/kyougaku/indexSP.jsp', // AI 시간표 읽기 시작점: 教務Webサービス
    aiTimetableLabel: '教務Webサービス',
    manabaUrl:   '', // 자체 LMS 사용 (教務Webサービス)
    lmsUrl:      'https://ris.acc.senshu-u.ac.jp/kyougaku/indexSP.jsp',
    lmsLabel:    '教務システム',
    autoLoginCandidates: ['ris.acc.senshu-u.ac.jp'], // 폼 밖 <a onclick=goLogin()> 제출 — 스크립트가 문서 전체에서 ログイン 링크 탐색 (2026-09-20 실측)
    syllabusUrl: 'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slbssrch.do',
    portalUrl:   '',
  },
  'teikyo-u': {
    homepageUrl: 'https://www.teikyo-u.ac.jp',
    aiTimetableUrl:   'https://portal.cs.teikyo-u.ac.jp/campusweb', // AI 시간표 읽기 시작점: CampusSquare (Extic SSO)
    aiTimetableLabel: 'CampusSquare',
    aiTimetableGuide: '履修 → 履修登録・登録状況照会',
    manabaUrl:   '', // 자체 LMS 사용
    lmsUrl:      'https://lms2017.teikyo-u.ac.jp/',
    lmsLabel:    'LMS',
    autoLoginCandidates: ['lms2017.teikyo-u.ac.jp'], // text+password+submit (2026-09-20 curl 실측)
    syllabusUrl: 'https://activeacademy.ita.teikyo-u.ac.jp/aa_web/syllabus/faculties.aspx', // 板橋キャンパス
    portalUrl:   '',
  },

  // ── 배치 2 ────────────────────────────────────────────────────────────────
  'kanagawa-u': {
    homepageUrl: 'https://www.kanagawa-u.ac.jp',
    aiTimetableUrl:   'https://webstation.kanagawa-u.ac.jp/campusweb/portal.do', // AI 시간표 읽기 시작점: WeB St@tion = CampusSquare (MNS SSO)
    aiTimetableLabel: 'WeB St@tion',
    aiTimetableGuide: '教務／授業関連 → 履修',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://kulms.kanagawa-u.ac.jp/webclass/login.php', // 루트는 "ログイン画面を表示する" 클릭이 새창(window.open)이라 WebView에서 막힘 → 로그인 페이지 직행
    lmsLabel:    'WebClass',
    autoLoginCandidates: ['kulms.kanagawa-u.ac.jp'], // WebClass 표준 폼 (2026-09-20 Chrome 실측)
    syllabusUrl: 'https://webstation-koukai.kanagawa-u.ac.jp',
    portalUrl:   '',
  },
  tokai: {
    homepageUrl: 'https://www.u-tokai.ac.jp',
    aiTimetableUrl:   'https://cleweb.tsc.u-tokai.ac.jp/campusweb/top.do', // AI 시간표 읽기 시작점: キャンパスライフエンジン = CampusSquare
    aiTimetableLabel: 'キャンパスライフエンジン',
    aiTimetableGuide: '学修 → Web履修登録',
    manabaUrl:   '', // Open LMS 사용
    lmsUrl:      'https://tlms.tsc.u-tokai.ac.jp/', // 2025-05 이전 주소(lms.u-tokai.ac.jp)에서 변경. Microsoft SSO(2단계 폼) → 자동입력 미지원, 쿠키 유지만
    lmsLabel:    'Open LMS',
    syllabusUrl: '', // www24.tsc.u-tokai.ac.jp 사망(2026-09). 공개 시라바스 주소 미확인
    portalUrl:   '',
  },
  daito: {
    homepageUrl: 'https://www.daito.ac.jp',
    aiTimetableUrl:   'https://dbp.mypage.daito.ac.jp/', // AI 시간표 읽기 시작점: DBポータル
    aiTimetableLabel: 'DBポータル',
    manabaUrl:   'https://daito.manaba.jp', // manaba 사용 확인. 로그인은 Microsoft Entra SSO(2단계 폼) → 자동입력 미지원, 쿠키 유지만
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },
  'asia-u': {
    homepageUrl: 'https://www.asia-u.ac.jp',
    aiTimetableUrl:   'https://cx.asia-u.ac.jp/campusweb/top.do', // AI 시간표 읽기 시작점: Campus-Xs = CampusSquare
    aiTimetableLabel: 'Campus-Xs',
    aiTimetableGuide: '履修 → 履修登録・登録状況照会',
    manabaUrl:   'https://asia-u.manaba.jp/ct/login', // manaba 사용 확인
    // ex-tic IdP 폼: identifier + password + submit 단일 폼 (2026-09-20 curl 실측). manaba 자체 폼도 대비
    autoLoginCandidates: ['asia.ex-tic.com', 'asia-u.manaba.jp'],
    syllabusUrl: 'https://cx.asia-u.ac.jp/campusweb/slbssrch.do', // portal.asia-u.ac.jp → cx.asia-u.ac.jp 로 이전(2026-09 확인)
    portalUrl:   '',
  },
  'takushoku-u': {
    homepageUrl: 'https://www.takushoku-u.ac.jp',
    aiTimetableUrl:   'https://portal.takushoku-u.ac.jp/campusweb/top.do', // AI 시간표 읽기 시작점: CampusSquare
    aiTimetableLabel: 'CampusSquare',
    aiTimetableGuide: '履修 → 履修登録・登録状況照会',
    manabaUrl:   '',
    lmsUrl:      'https://portal.takushoku-u.ac.jp/campusweb/top.do',
    lmsLabel:    'ポータル',
    autoLoginCandidates: ['portal.takushoku-u.ac.jp'], // CampusSquare: type=button+exec('login') JS 제출 — 스크립트가 ログイン 버튼 click (2026-09-20 실측)
    syllabusUrl: 'https://syllabus.takushoku-u.ac.jp/',
    portalUrl:   '',
  },

  // ── 배치 3 ────────────────────────────────────────────────────────────────
  dendai: {
    homepageUrl: 'https://www.dendai.ac.jp',
    aiTimetableUrl:   'https://portal.sa.dendai.ac.jp/uprx/', // AI 시간표 읽기 시작점: UNIPA RX
    aiTimetableLabel: 'DENDAI-UNIPA',
    aiTimetableGuide: '時間割表 → 本人',
    manabaUrl:   '', // DENDAI-UNIPA 자체 LMS 사용
    lmsUrl:      'https://portal.sa.dendai.ac.jp/uprx/up/pk/pky501/Pky50101.xhtml',
    lmsLabel:    'UNIPA',
    autoLoginCandidates: ['portal.sa.dendai.ac.jp'], // UNIPA(PrimeFaces) text+password+button[type=submit] (2026-09-20 curl 실측)
    syllabusUrl: 'https://www.dendai.ac.jp/about/campuslife/syllabus/',
    portalUrl:   '',
  },
  tamagawa: {
    homepageUrl: 'https://www.tamagawa.jp/university/',
    aiTimetableUrl:   'https://unitama.tamagawa.ac.jp/uprx/', // AI 시간표 읽기 시작점: UNITAMA = UNIPA RX
    aiTimetableLabel: 'UNITAMA',
    aiTimetableGuide: '時間割表 → 本人',
    manabaUrl:   '', // Blackboard(수업) + UNITAMA(포털) 사용. 포털을 대표 링크로
    lmsUrl:      'https://unitama.tamagawa.ac.jp/uprx/', // 루트는 meta refresh → /uprx/ (UNIPA 로그인 폼)
    lmsLabel:    'UNITAMA',
    autoLoginCandidates: ['unitama.tamagawa.ac.jp'], // UNIPA 폼, 電機와 동일 (2026-09-20 curl 실측)
    syllabusUrl: 'http://acweb01.adm.tamagawa.ac.jp/Syllabus.nsf',
    portalUrl:   '',
  },
  nodai: {
    homepageUrl: 'https://www.nodai.ac.jp',
    aiTimetableUrl:   'https://ngp.nodai.ac.jp/portalv3/sptop.do', // AI 시간표 읽기 시작점: 農大ポータル
    aiTimetableLabel: '農大ポータル',
    aiTimetableGuide: 'My時間割',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://lms.nodai.ac.jp/webclass/login.php', // 루트는 새창 런처 → 로그인 페이지 직행
    lmsLabel:    'WebClass',
    autoLoginCandidates: ['lms.nodai.ac.jp'], // WebClass 표준 폼 (2026-09-20 curl 실측)
    syllabusUrl: 'https://ngp.nodai.ac.jp/portalv3/slbsscmr.do',
    portalUrl:   '',
  },
  tcu: {
    homepageUrl: 'https://www.tcu.ac.jp',
    aiTimetableUrl:   'https://websrv.tcu.ac.jp/tcu_web_v3/', // AI 시간표 읽기 시작점: Campusmate-J
    aiTimetableLabel: 'Campusmate-J',
    aiTimetableGuide: '履修登録・確認・変更',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://webclass.tcu.ac.jp/webclass/login.php', // 루트는 새창 런처 → 로그인 페이지 직행
    lmsLabel:    'WebClass',
    autoLoginCandidates: ['webclass.tcu.ac.jp'], // WebClass 표준 폼 (2026-09-20 curl 실측)
    autoLoginBlocked: '公式アプリ以外へのID/PW入力を禁止（情報システム利用規則 第4条2項）',
    syllabusUrl: 'https://websrv.tcu.ac.jp/tcu_web_v3/slbsskgr.do',
    portalUrl:   '',
  },

  // ── 배치 4 ────────────────────────────────────────────────────────────────
  oiu: {
    homepageUrl: 'https://www.oiu.ac.jp',
    aiTimetableUrl:   'https://portal.oiu.ac.jp/uprx/', // AI 시간표 읽기 시작점: OIU UNIPA = UNIPA RX
    aiTimetableLabel: 'OIU UNIPA',
    aiTimetableGuide: '時間割表 → 本人',
    manabaUrl:   '', // manaba 미사용 (Moodle + OIU UNIPA)
    lmsUrl:      'https://www6.oiu.ac.jp/share/htdocs/',
    lmsLabel:    'ポータル',
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },
  nbu: {
    homepageUrl: 'https://www.nbu.ac.jp',
    aiTimetableUrl:   'https://www.nbu.ac.jp/upx-login.html', // AI 시간표 읽기 시작점: UNIPA RX(✅재학생 확인 2026-10-19). unipax 직행은 학외 HTTP Basic 인증(401)이라 앱 브라우저에서 막힐 수 있어 안내 페이지부터
    aiTimetableLabel: 'ユニバーサルパスポート',
    aiTimetableGuide: '時間割表 → 本人',
    manabaUrl:   '', // manaba 미사용 (UNIVERSAL PASSPORT)
    lmsUrl:      'https://www.nbu.ac.jp/upx-login.html', // 안내 페이지. 실제 unipax.nbu.ac.jp 는 HTTP Basic 인증(401) → 폼이 아니라 자동입력 불가, 쿠키 유지만
    lmsLabel:    'UNIPA',
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },

  // ── 배치 5 (2026-09-20) ─────────────────────────────────────────────────
  doshisha: {
    homepageUrl: 'https://www.doshisha.ac.jp',
    aiTimetableUrl:   'https://duet.doshisha.ac.jp/gakusei/html/fb/fb010/FB01001G.html', // AI 시간표 읽기 시작점: DUET (ex-tic SSO)
    aiTimetableLabel: 'DUET',
    manabaUrl:   '', // manaba 미사용. e-class(WebClass) + DUET(학사 포털), 로그인은 전부 ex-tic SSO
    lmsUrl:      'https://eclass.doshisha.ac.jp/webclass/singlesignon.php?auth_mode=SHIB&auth_only=1', // 루트는 JS 리다이렉트 톱페이지 → SSO 진입 URL 직행(2026-09-20 curl: doshisha.ex-tic.com/auth/session 도착 확인)
    lmsLabel:    'e-class',
    portalUrl:   'https://duet.doshisha.ac.jp/', // 学修支援システム DUET (SSO 필수)
    portalLabel: 'DUET',
    syllabusUrl: 'https://syllabus.doshisha.ac.jp/', // 공개 시라바스 검색 (2026-09-20 생존 확인)
    // ex-tic IdP 폼 = 亜細亜와 동일 구조 (2026-09-20 curl 실측)
    autoLoginCandidates: ['doshisha.ex-tic.com'],
    autoLoginBlocked: '2017 ID/PW入力が必要な時間割アプリに注意喚起',
  },

  // ── 明治大学 (2026-10-19) — 근거·확인일 docs/schools/meiji.md ──────────────
  meiji: {
    homepageUrl: 'https://www.meiji.ac.jp',
    // 시간표는 LMS(Oh-o! Meiji)가 아니라 教務システム(Campus-Xs) 「履修成績 → My時間割」. 학생은 「共通認証」으로 로그인(학외 2단계 인증)
    aiTimetableUrl:   'https://meiji-kyomu.mind.meiji.ac.jp/campusweb/top.do', // AI 시간표 읽기 시작점: 教務システム = Campus-Xs
    aiTimetableLabel: '教務システム',
    aiTimetableGuide: '共通認証でログイン → 履修成績 → My時間割',
    manabaUrl:   '', // manaba 미사용
    lmsUrl:      'https://www.oh-o.meiji.ac.jp/', // Oh-o! Meiji (2025 리뉴얼판. 旧 oh-o2.meiji.ac.jp 는 2024년도 이전 수업용)
    lmsLabel:    'Oh-o! Meiji',
    portalUrl:   '',
    syllabusUrl: '', // 공개 시라바스 주소 미확인
    // 자동입력 OFF — 대학이 "パスワードは家族や友人にも教えない" 안내, 학외 2단계 인증 필수
  },
};
