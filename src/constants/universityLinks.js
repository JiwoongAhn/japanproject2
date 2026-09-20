// 대학별 링크 정보 (manaba, 홈페이지 등)
// HomeScreen의 학교정보 그리드에서 .filter(item => item.url)로 빈 문자열('')은 자동 숨김
// syllabusUrl이 있으면 시간표 화면에 シラバスボタン 표시
//
// 필드 설명
//   homepageUrl   필수. 외부 브라우저로 연다
//   manabaUrl     manaba 로그인 URL (manaba 학교만). 있으면 お知らせ 자동취득·리마인더 기능 활성
//   lmsUrl/lmsLabel   manaba 미사용 학교의 LMS (쌍으로). 앱 내 브라우저(쿠키 유지)로 연다
//   portalUrl/portalLabel  학사 포털 (쌍으로). 국사관 kaede-i 등. 앱 내 브라우저로 연다
//   timetableUrl  一括取り込み 전용 파서가 있는 학교만 (현재 국사관 kaede-i). 없으면 一括 버튼 숨김
//   autoLoginHosts  ID/PW 기기 저장 + 자동입력을 허용하는 로그인 폼 호스트 목록.
//                   SSO 학교는 IdP 호스트를 명시. 없거나 빈 배열 = 쿠키 영속만(자동입력 없음).
//                   ⚠️ 오타로 엉뚱한 사이트에 비밀번호가 들어가지 않도록 테스트가 형식·소속을 검증한다.
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
    manabaUrl:   'https://www.ace.toyo.ac.jp/ct/login', // ToyoNet-ACE = manaba 2.98 (www. 필수, ace.toyo.ac.jp 는 DNS 없음). 로그인은 secioss SAML SSO 로 리다이렉트
    syllabusUrl: 'https://g-sys.toyo.ac.jp/syllabus/',
    portalUrl:   '',
  },
  'komazawa-u': {
    homepageUrl: 'https://www.komazawa-u.ac.jp',
    manabaUrl:   '', // KONECO 자체 LMS 사용
    lmsUrl:      'https://koneco.komazawa-u.ac.jp/',
    lmsLabel:    'KONECO',
    syllabusUrl: 'https://koneco.komazawa-u.ac.jp/',
    portalUrl:   '',
  },
  'senshu-u': {
    homepageUrl: 'https://www.senshu-u.ac.jp',
    manabaUrl:   '', // 자체 LMS 사용 (教務Webサービス)
    lmsUrl:      'https://ris.acc.senshu-u.ac.jp/kyougaku/indexSP.jsp',
    lmsLabel:    '教務システム',
    syllabusUrl: 'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slbssrch.do',
    portalUrl:   '',
  },
  'teikyo-u': {
    homepageUrl: 'https://www.teikyo-u.ac.jp',
    manabaUrl:   '', // 자체 LMS 사용
    lmsUrl:      'https://lms2017.teikyo-u.ac.jp/',
    lmsLabel:    'LMS',
    syllabusUrl: 'https://activeacademy.ita.teikyo-u.ac.jp/aa_web/syllabus/faculties.aspx', // 板橋キャンパス
    portalUrl:   '',
  },

  // ── 배치 2 ────────────────────────────────────────────────────────────────
  'kanagawa-u': {
    homepageUrl: 'https://www.kanagawa-u.ac.jp',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://kulms.kanagawa-u.ac.jp/',
    lmsLabel:    'WebClass',
    syllabusUrl: 'https://webstation-koukai.kanagawa-u.ac.jp',
    portalUrl:   '',
  },
  tokai: {
    homepageUrl: 'https://www.u-tokai.ac.jp',
    manabaUrl:   '', // Open LMS 사용
    lmsUrl:      'https://tlms.tsc.u-tokai.ac.jp/', // 2025-05 이전 주소(lms.u-tokai.ac.jp)에서 변경. Microsoft SSO
    lmsLabel:    'Open LMS',
    syllabusUrl: '', // www24.tsc.u-tokai.ac.jp 사망(2026-09). 공개 시라바스 주소 미확인
    portalUrl:   '',
  },
  daito: {
    homepageUrl: 'https://www.daito.ac.jp',
    manabaUrl:   'https://daito.manaba.jp', // manaba 사용 확인
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },
  'asia-u': {
    homepageUrl: 'https://www.asia-u.ac.jp',
    manabaUrl:   'https://asia-u.manaba.jp/ct/login', // manaba 사용 확인
    syllabusUrl: 'https://cx.asia-u.ac.jp/campusweb/slbssrch.do', // portal.asia-u.ac.jp → cx.asia-u.ac.jp 로 이전(2026-09 확인)
    portalUrl:   '',
  },
  'takushoku-u': {
    homepageUrl: 'https://www.takushoku-u.ac.jp',
    manabaUrl:   '',
    lmsUrl:      'https://portal.takushoku-u.ac.jp/campusweb/top.do',
    lmsLabel:    'ポータル',
    syllabusUrl: 'https://syllabus.takushoku-u.ac.jp/',
    portalUrl:   '',
  },

  // ── 배치 3 ────────────────────────────────────────────────────────────────
  dendai: {
    homepageUrl: 'https://www.dendai.ac.jp',
    manabaUrl:   '', // DENDAI-UNIPA 자체 LMS 사용
    lmsUrl:      'https://portal.sa.dendai.ac.jp/uprx/up/pk/pky501/Pky50101.xhtml',
    lmsLabel:    'UNIPA',
    syllabusUrl: 'https://www.dendai.ac.jp/about/campuslife/syllabus/',
    portalUrl:   '',
  },
  tamagawa: {
    homepageUrl: 'https://www.tamagawa.jp/university/',
    manabaUrl:   '', // Blackboard(수업) + UNITAMA(포털) 사용. 포털을 대표 링크로
    lmsUrl:      'https://unitama.tamagawa.ac.jp/',
    lmsLabel:    'UNITAMA',
    syllabusUrl: 'http://acweb01.adm.tamagawa.ac.jp/Syllabus.nsf',
    portalUrl:   '',
  },
  nodai: {
    homepageUrl: 'https://www.nodai.ac.jp',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://lms.nodai.ac.jp/',
    lmsLabel:    'WebClass',
    syllabusUrl: 'https://ngp.nodai.ac.jp/portalv3/slbsscmr.do',
    portalUrl:   '',
  },
  tcu: {
    homepageUrl: 'https://www.tcu.ac.jp',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://webclass.tcu.ac.jp/',
    lmsLabel:    'WebClass',
    syllabusUrl: 'https://websrv.tcu.ac.jp/tcu_web_v3/slbsskgr.do',
    portalUrl:   '',
  },

  // ── 배치 4 ────────────────────────────────────────────────────────────────
  oiu: {
    homepageUrl: 'https://www.oiu.ac.jp',
    manabaUrl:   '', // manaba 미사용 (Moodle + OIU UNIPA)
    lmsUrl:      'https://www6.oiu.ac.jp/share/htdocs/',
    lmsLabel:    'ポータル',
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },
  nbu: {
    homepageUrl: 'https://www.nbu.ac.jp',
    manabaUrl:   '', // manaba 미사용 (UNIVERSAL PASSPORT)
    lmsUrl:      'https://www.nbu.ac.jp/upx-login.html',
    lmsLabel:    'UNIPA',
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },
};
