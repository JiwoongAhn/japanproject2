// 대학별 링크 정보 (manaba, 홈페이지 등)
// HomeScreen의 학교정보 그리드에서 .filter(item => item.url)로 빈 문자열('')은 자동 숨김
// syllabusUrl이 있으면 시간표 화면에 シラバスボタン 표시
export const universityLinks = {

  // ── 국사관대학 ────────────────────────────────────────────────────────────
  kokushikan: {
    homepageUrl: 'https://www.kokushikan.ac.jp',
    manabaUrl:   'https://kokushikan.manaba.jp/ct/login',
    kaedeUrl:    'https://kaedei.kokushikan.ac.jp',
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
    kaedeUrl:    '',
    syllabusUrl: '', // 캠퍼스별 URL 상이
    portalUrl:   '',
  },

  // ── 배치 2 ────────────────────────────────────────────────────────────────
  'kanagawa-u': {
    homepageUrl: 'https://www.kanagawa-u.ac.jp',
    manabaUrl:   '', // 자체 LMS 사용
    kaedeUrl:    '',
    syllabusUrl: 'https://webstation-koukai.kanagawa-u.ac.jp',
    portalUrl:   '',
  },
  tokai: {
    homepageUrl: 'https://www.u-tokai.ac.jp',
    manabaUrl:   '', // 자체 LMS 사용
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
    manabaUrl:   '', // 미확인
    kaedeUrl:    '',
    syllabusUrl: 'https://syllabus.takushoku-u.ac.jp/',
    portalUrl:   '',
  },

  // ── 배치 3 ────────────────────────────────────────────────────────────────
  dendai: {
    homepageUrl: 'https://www.dendai.ac.jp',
    manabaUrl:   '', // DENDAI-UNIPA 자체 LMS 사용
    kaedeUrl:    '',
    syllabusUrl: 'https://www.dendai.ac.jp/about/campuslife/syllabus/',
    portalUrl:   '',
  },
  tamagawa: {
    homepageUrl: 'https://www.tamagawa.jp/university/',
    manabaUrl:   '', // Blackboard/UNITAMA 자체 LMS 사용
    kaedeUrl:    '',
    syllabusUrl: '', // 외부 공개 URL 미확인
    portalUrl:   '',
  },
  nodai: {
    homepageUrl: 'https://www.nodai.ac.jp',
    manabaUrl:   '', // 자체 포털(農大ポータル) 사용
    kaedeUrl:    '',
    syllabusUrl: '', // 포털 로그인 필요
    portalUrl:   '',
  },
  tcu: {
    homepageUrl: 'https://www.tcu.ac.jp',
    manabaUrl:   '', // 자체 포털 사용
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
