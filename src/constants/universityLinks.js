// 대학별 링크 정보 (manaba, 홈페이지 등)
// HomeScreen의 학교정보 그리드에서 .filter(item => item.url)로 빈 문자열('')은 자동 숨김
// syllabusUrl이 있으면 시간표 화면에 シラバスボタン 표시
export const universityLinks = {

  // ── 국사관대학 ────────────────────────────────────────────────────────────
  kokushikan: {
    homepageUrl: 'https://www.kokushikan.ac.jp',
    manabaUrl:   'https://kokushikan.manaba.jp/ct/login',
    kaedeUrl:    'https://kaedei.kokushikan.ac.jp',
    timetableUrl:'https://kaedei.kokushikan.ac.jp/Main/MyTimeTable.aspx', // 一括取り込み: 로그인 후 ReturnUrl로 자동 복귀
    syllabusUrl: 'https://kaedei.kokushikan.ac.jp/Syllabus/Top.aspx',
    portalUrl:   'https://portal.kokushikan.ac.jp',
  },

  // ── 배치 1 ────────────────────────────────────────────────────────────────
  'nihon-u': {
    homepageUrl: 'https://www.nihon-u.ac.jp',
    manabaUrl:   '', // 자체 LMS 사용 (학부별 상이)
    kaedeUrl:    '',
    syllabusUrl: '', // 학부별 URL 상이 — 일괄 제공 불가
    portalUrl:   '',
  },
  toyo: {
    homepageUrl: 'https://www.toyo.ac.jp',
    manabaUrl:   'https://ace.toyo.ac.jp', // ToyoNet-ACE (manaba 기반)
    kaedeUrl:    '',
    syllabusUrl: 'https://g-sys.toyo.ac.jp/syllabus/',
    portalUrl:   '',
  },
  'komazawa-u': {
    homepageUrl: 'https://www.komazawa-u.ac.jp',
    manabaUrl:   '', // KONECO 자체 LMS 사용
    kaedeUrl:    '',
    syllabusUrl: 'https://koneco.komazawa-u.ac.jp/',
    portalUrl:   '',
  },
  'senshu-u': {
    homepageUrl: 'https://www.senshu-u.ac.jp',
    manabaUrl:   '', // 자체 LMS 사용
    kaedeUrl:    '',
    syllabusUrl: 'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slbssrch.do',
    portalUrl:   '',
  },
  'teikyo-u': {
    homepageUrl: 'https://www.teikyo-u.ac.jp',
    manabaUrl:   '', // 자체 LMS 사용
    lmsUrl:      'https://lms2017.teikyo-u.ac.jp/',
    lmsLabel:    'LMS',
    kaedeUrl:    '',
    syllabusUrl: 'https://activeacademy.ita.teikyo-u.ac.jp/aa_web/syllabus/faculties.aspx', // 板橋キャンパス
    portalUrl:   '',
  },

  // ── 배치 2 ────────────────────────────────────────────────────────────────
  'kanagawa-u': {
    homepageUrl: 'https://www.kanagawa-u.ac.jp',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://kulms.kanagawa-u.ac.jp/',
    lmsLabel:    'WebClass',
    kaedeUrl:    '',
    syllabusUrl: 'https://webstation-koukai.kanagawa-u.ac.jp',
    portalUrl:   '',
  },
  tokai: {
    homepageUrl: 'https://www.u-tokai.ac.jp',
    manabaUrl:   '', // Open LMS 사용
    lmsUrl:      'https://lms.u-tokai.ac.jp/',
    lmsLabel:    'Open LMS',
    kaedeUrl:    '',
    syllabusUrl: 'https://www24.tsc.u-tokai.ac.jp/syllabus/SYLSCHTOP',
    portalUrl:   '',
  },
  daito: {
    homepageUrl: 'https://www.daito.ac.jp',
    manabaUrl:   'https://daito.manaba.jp', // manaba 사용 확인
    kaedeUrl:    '',
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },
  'asia-u': {
    homepageUrl: 'https://www.asia-u.ac.jp',
    manabaUrl:   'https://asia-u.manaba.jp/ct/login', // manaba 사용 확인
    kaedeUrl:    '',
    syllabusUrl: 'https://portal.asia-u.ac.jp/campusweb/slbssrch.do',
    portalUrl:   '',
  },
  'takushoku-u': {
    homepageUrl: 'https://www.takushoku-u.ac.jp',
    manabaUrl:   '',
    lmsUrl:      'https://portal.takushoku-u.ac.jp/campusweb/top.do',
    lmsLabel:    'ポータル',
    kaedeUrl:    '',
    syllabusUrl: 'https://syllabus.takushoku-u.ac.jp/',
    portalUrl:   '',
  },

  // ── 배치 3 ────────────────────────────────────────────────────────────────
  dendai: {
    homepageUrl: 'https://www.dendai.ac.jp',
    manabaUrl:   '', // DENDAI-UNIPA 자체 LMS 사용
    lmsUrl:      'https://portal.sa.dendai.ac.jp/uprx/up/pk/pky501/Pky50101.xhtml',
    lmsLabel:    'UNIPA',
    kaedeUrl:    '',
    syllabusUrl: 'https://www.dendai.ac.jp/about/campuslife/syllabus/',
    portalUrl:   '',
  },
  tamagawa: {
    homepageUrl: 'https://www.tamagawa.jp/university/',
    manabaUrl:   '', // Blackboard 사용 (外部公開URLなし)
    kaedeUrl:    '',
    syllabusUrl: 'http://acweb01.adm.tamagawa.ac.jp/Syllabus.nsf',
    portalUrl:   '',
  },
  nodai: {
    homepageUrl: 'https://www.nodai.ac.jp',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://lms.nodai.ac.jp/',
    lmsLabel:    'WebClass',
    kaedeUrl:    '',
    syllabusUrl: 'https://ngp.nodai.ac.jp/portalv3/slbsscmr.do',
    portalUrl:   '',
  },
  tcu: {
    homepageUrl: 'https://www.tcu.ac.jp',
    manabaUrl:   '', // WebClass 사용
    lmsUrl:      'https://webclass.tcu.ac.jp/',
    lmsLabel:    'WebClass',
    kaedeUrl:    '',
    syllabusUrl: 'https://websrv.tcu.ac.jp/tcu_web_v3/slbsskgr.do',
    portalUrl:   '',
  },

  // ── 배치 4 ────────────────────────────────────────────────────────────────
  oiu: {
    homepageUrl: 'https://www.oiu.ac.jp',
    manabaUrl:   '', // 미확인
    kaedeUrl:    '',
    syllabusUrl: '', // 미확인
    portalUrl:   '',
  },
  nbu: {
    homepageUrl: 'https://www.nbu.ac.jp',
    manabaUrl:   '', // 미확인
    kaedeUrl:    '',
    syllabusUrl: '', // 미확인
    portalUrl:   '',
  },
};
