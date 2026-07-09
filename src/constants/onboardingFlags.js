// 온보딩 흐름에서 화면 간에 공유하는 AsyncStorage 플래그 키 모음.
// (화면 컴포넌트끼리 직접 import하는 결합을 피하기 위해 상수만 분리)

// 온보딩 마지막 CTA에서 manaba 설정을 선택하면 저장됨.
// 홈 최초 진입 시 이 플래그가 있으면 MailConnectOnboarding을 1회 자동으로 연다.
export const OPEN_MAIL_CONNECT_KEY = 'open_mail_connect_on_launch_v1';
