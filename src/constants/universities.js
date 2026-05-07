// 지원 대학교 목록
// emailDomain: 학교에서 학생에게 실제 발급하는 이메일 도메인 (이메일 인증 + 학교 식별에 사용)
//   ※ 서브도메인 포함 정확한 형식 필요 (예: stu.teikyo-u.ac.jp, g.nihon-u.ac.jp)
// campuses: 주요 캠퍼스 목록
// periodRanges: 학교별 교시 시간 (없으면 국사관 기본값 자동 사용)
// URL 정보는 src/constants/universityLinks.js 참조
export const universities = [
  {
    id: 'kokushikan',
    name: '国士館大学',
    location: '東京都世田谷区',
    emailDomain: 'kokushikan.ac.jp',
    campuses: ['世田谷キャンパス', '多摩キャンパス', '鶴川キャンパス'],
    periodRanges: {
      1: { start: 9 * 60,       end: 10 * 60 + 30 }, // 9:00 ~ 10:30
      2: { start: 10 * 60 + 45, end: 12 * 60 + 15 }, // 10:45 ~ 12:15
      3: { start: 12 * 60 + 55, end: 14 * 60 + 25 }, // 12:55 ~ 14:25
      4: { start: 14 * 60 + 40, end: 16 * 60 + 10 }, // 14:40 ~ 16:10
      5: { start: 16 * 60 + 25, end: 17 * 60 + 55 }, // 16:25 ~ 17:55
      6: { start: 18 * 60 + 10, end: 19 * 60 + 40 }, // 18:10 ~ 19:40
    },
  },

  // ── 배치 1 ────────────────────────────────────────────────────────────────
  {
    id: 'nihon-u',
    name: '日本大学',
    location: '東京都千代田区',
    emailDomain: 'g.nihon-u.ac.jp', // NU-MailG (Google Workspace)
    campuses: ['文理学部(世田谷)', '法学部(千代田)', '経済学部(千代田)', '商学部(千代田)', '芸術学部(練馬)', '工学部(福島)'],
  },
  {
    id: 'toyo',
    name: '東洋大学',
    location: '東京都文京区',
    emailDomain: 'toyo.jp', // ToyoNetメール (Google Workspace)
    campuses: ['白山キャンパス', '朝霞キャンパス', '川越キャンパス', '赤羽台キャンパス'],
  },
  {
    id: 'komazawa-u',
    name: '駒澤大学',
    location: '東京都世田谷区',
    emailDomain: 'komazawa-u.ac.jp', // KOMAnet Gmail (Google Workspace)
    campuses: ['駒沢キャンパス'],
  },
  {
    id: 'senshu-u',
    name: '専修大学',
    location: '東京都千代田区',
    emailDomain: 'senshu-u.jp', // 専修大学Gmail
    campuses: ['神田キャンパス', '生田キャンパス'],
  },
  {
    id: 'teikyo-u',
    name: '帝京大学',
    location: '東京都板橋区',
    emailDomain: 'stu.teikyo-u.ac.jp', // 帝京大学Gmail (Google Workspace)
    campuses: ['板橋キャンパス', '八王子キャンパス', '宇都宮キャンパス', '福岡キャンパス'],
  },

  // ── 배치 2 ────────────────────────────────────────────────────────────────
  {
    id: 'kanagawa-u',
    name: '神奈川大学',
    location: '神奈川県横浜市',
    emailDomain: 'jindai.jp', // JINDAIメール (Microsoft 365)
    campuses: ['横浜キャンパス', 'みなとみらいキャンパス', '湘南ひらつかキャンパス'],
  },
  {
    id: 'tokai',
    name: '東海大学',
    location: '神奈川県平塚市',
    emailDomain: 'mail.u-tokai.ac.jp', // T365 (Microsoft 365)
    campuses: ['湘南キャンパス', '札幌キャンパス', '熊本キャンパス', '伊勢原キャンパス'],
  },
  {
    id: 'daito',
    name: '大東文化大学',
    location: '東京都板橋区',
    emailDomain: 'st.daito.ac.jp', // Gmail (Google Workspace)
    campuses: ['板橋キャンパス', '東松山キャンパス'],
  },
  {
    id: 'asia-u',
    name: '亜細亜大学',
    location: '東京都武蔵野市',
    emailDomain: 'asia-u.ac.jp', // Google Workspace (形式要確認)
    campuses: ['武蔵野キャンパス'],
  },
  {
    id: 'takushoku-u',
    name: '拓殖大学',
    location: '東京都文京区',
    emailDomain: 'st.takushoku-u.ac.jp', // Microsoft 365
    campuses: ['文京キャンパス', '八王子国際キャンパス'],
  },

  // ── 배치 3 ────────────────────────────────────────────────────────────────
  {
    id: 'dendai',
    name: '東京電機大学',
    location: '東京都足立区',
    emailDomain: 'ms.dendai.ac.jp', // Microsoft 365
    campuses: ['東京千住キャンパス', '埼玉鳩山キャンパス', '千葉新柏キャンパス'],
  },
  {
    id: 'tamagawa',
    name: '玉川大学',
    location: '東京都町田市',
    emailDomain: 'stu.tamagawa.ac.jp', // Microsoft 365 Outlook
    campuses: ['玉川学園キャンパス'],
  },
  {
    id: 'nodai',
    name: '東京農業大学',
    location: '東京都世田谷区',
    emailDomain: 'nodai.ac.jp', // Microsoft 365
    campuses: ['世田谷キャンパス', '厚木キャンパス', '網走キャンパス'],
  },
  {
    id: 'tcu',
    name: '東京都市大学',
    location: '東京都世田谷区',
    emailDomain: 'tcu.ac.jp', // TCUメール (Microsoft 365)
    campuses: ['世田谷キャンパス', '横浜キャンパス', '等々力キャンパス'],
  },

  // ── 배치 4 ────────────────────────────────────────────────────────────────
  {
    id: 'oiu',
    name: '大阪国際大学',
    location: '大阪府守口市',
    emailDomain: 'oiu.jp', // 大学発行 Google アカウント
    campuses: ['守口キャンパス', '枚方キャンパス'],
  },
  {
    id: 'nbu',
    name: '日本文理大学',
    location: '大分県大分市',
    emailDomain: 'nbu.ac.jp',
    campuses: ['大分キャンパス'],
  },
];
