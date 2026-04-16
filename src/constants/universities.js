// 지원 대학교 목록
// 나중에 대학을 추가할 때 이 배열에만 추가하면 됩니다
// emailDomain: 학교에서 학생에게 발급하는 ac.jp 이메일 도메인 (이메일 인증에 사용)
export const universities = [
  {
    id: 'kokushikan',
    name: '国士館大学',
    nameKo: '국사관대학교',
    location: '東京都世田谷区',
    emailDomain: 'kokushikan.ac.jp', // 예: A1234567@kokushikan.ac.jp
    portalUrl: 'https://portal.kokushikan.ac.jp',
    homepageUrl: 'https://www.kokushikan.ac.jp',
    manabaUrl:   'https://kokushikan.manaba.jp/ct/login',
    kaedeUrl:    'https://kaedei.kokushikan.ac.jp',
    syllabusUrl: 'https://kaedei.kokushikan.ac.jp/Syllabus/Top.aspx',
  },
  // 추후 대학 추가 예시:
  // {
  //   id: 'waseda',
  //   name: '早稲田大学',
  //   nameKo: '와세다대학교',
  //   location: '東京都新宿区',
  //   emailDomain: 'waseda.jp',
  //   portalUrl: 'https://portal.waseda.jp',
  //   homepageUrl: 'https://www.waseda.jp',
  //   manabaUrl:   'https://manaba.waseda.jp',
  //   kaedeUrl:    '',
  //   syllabusUrl: 'https://www.waseda.jp/syllabus/',
  // },
];
