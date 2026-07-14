// 온보딩 흐름에서 화면 간에 공유하는 AsyncStorage 플래그 키 모음.
// (화면 컴포넌트끼리 직접 import하는 결합을 피하기 위해 상수만 분리)

// 온보딩 마지막 CTA에서 manaba 설정을 선택하면 저장됨.
// 홈 최초 진입 시 이 플래그가 있으면 MailConnectOnboarding을 1회 자동으로 연다.
export const OPEN_MAIL_CONNECT_KEY = 'open_mail_connect_on_launch_v1';

// 홈에서 manaba 공지 카드를 처음 탭했을 때, 사용법(스와이프 삭제·탭 이동)을
// 안내하는 코치 모달을 1회만 표시하기 위한 플래그.
export const NOTICE_COACH_SHOWN_KEY = 'manaba_notice_coach_shown_v1';
