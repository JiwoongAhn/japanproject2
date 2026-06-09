// manaba 공용 상수 — manaba 로그인 화면(ManabaLoginScreen)과
// 홈 화면 공지 미리보기(ManabaNoticePreview)가 같은 파서/URL을 공유한다.
// (한 곳에서만 관리해 한쪽만 고쳐 버그 나는 일을 방지)

// 학교 서버에 접속하는 WebView의 UA 끝에 덧붙이는 앱 식별자.
// applicationNameForUserAgent prop으로 주입 → 기존 브라우저 UA는 유지하고 식별자만 추가.
// (학교가 트래픽 출처를 식별할 수 있게 하는 투명성/선의 장치 — 약관 컴플라이언스)
export const UNIPAS_USER_AGENT = 'Unipas/1.0 (+https://unipas.app)';

export const MANABA_LOGIN_URL = 'https://kokushikan.manaba.jp/ct/login';

// 로그인 후 이동할 manaba 홈(공지가 모여 있는 페이지)
export const MANABA_HOME_URL = 'https://kokushikan.manaba.jp/ct/home';

// 로그아웃: 서버 세션을 끊는 manaba 로그아웃 엔드포인트
export const MANABA_LOGOUT_URL = 'https://kokushikan.manaba.jp/ct/logout';

// WebView에 주입하는 JS: 공지사항 리스트를 파싱해서 네이티브로 전달
// 결과 메시지: { type:'notices', data:[{title,href,date,board}], pageTitle, currentUrl }
export const PARSE_NOTICES_JS = `
(function() {
  try {
    var notices = [];

    // manaba 홈 공지사항 셀렉터 (학교별로 다를 수 있음)
    // 1순위: .home-newsitem (신버전 manaba)
    // 2순위: table.stdlist tr (구버전 manaba)
    // 3순위: 전체 링크 목록 fallback
    var items = document.querySelectorAll('.home-newsitem');

    if (items.length === 0) {
      items = document.querySelectorAll('table.stdlist tr');
    }

    if (items.length === 0) {
      // fallback: 링크가 있는 li 항목들
      items = document.querySelectorAll('.contents-area li, .news-list li');
    }

    items.forEach(function(item, i) {
      if (i >= 30) return;
      var link = item.querySelector('a');
      if (!link) return;

      var title = link.textContent.trim();
      // link.href는 브라우저가 문서 기준으로 절대경로를 정확히 계산해 줌
      // (상대경로/슬래시 누락으로 호스트가 깨져 -1003 에러 나던 문제 방지)
      var href = link.href || link.getAttribute('href') || '';
      if (href.indexOf('javascript:') === 0) href = '';

      // 날짜 추출 시도
      var date = '';
      var dateEl = item.querySelector('.date, .time, .post-date, td:first-child');
      if (dateEl) date = dateEl.textContent.trim();

      // 게시판/코스명 추출 시도
      var board = '';
      var boardEl = item.querySelector('.course-name, .board-name, td:nth-child(2)');
      if (boardEl) board = boardEl.textContent.trim();

      if (title) notices.push({ title, href, date, board });
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'notices',
      data: notices,
      pageTitle: document.title,
      currentUrl: window.location.href,
    }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'error',
      message: e.message,
    }));
  }
})();
true; // injectedJavaScript는 반드시 truthy 값으로 끝나야 함
`;
