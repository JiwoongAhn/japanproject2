// 네이티브(iOS/Android) 쿠키 매니저 — @react-native-cookies/cookies 를 그대로 재수출.
// 웹에서는 Metro 가 같은 이름의 cookieManager.web.js 를 대신 고른다.
// (이 라이브러리는 웹에서 import 되는 순간 "Invalid platform" 으로 앱 전체를 죽이므로
//  플랫폼별 파일로 분리해 웹 E2E·브라우저 실행을 살린다)
import CookieManager from '@react-native-cookies/cookies';
export default CookieManager;
