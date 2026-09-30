// 학교 사이트(kaede-i / manaba) 접속·로그인 실패를 분류하고 기록하는 유틸
//
// 배경(실기 버그 ④: 카에데아이 로그인이 한동안 안 되다가 저절로 정상화):
//   실패했을 때 앱은 "接続エラー" 한 마디만 보여주고 아무것도 남기지 않았다. 그래서
//   1) 사용자는 앱 문제인지 학교 서버 문제인지 알 수 없고
//   2) 나중에 원인을 추적할 근거도 전혀 남지 않는다.
//   → 실패를 종류별로 구분해 안내하고, 최근 기록을 기기에 남겨 재발 시 확인할 수 있게 한다.
//
// 기록은 기기 안에만 남는다(서버 전송 없음). 비밀번호 등 민감 정보는 절대 담지 않는다.

export const LOGIN_FAILURE_LOG_KEY = 'unione_login_failure_log';
// 기기에 보관할 최대 기록 수 (오래된 것부터 버림)
export const MAX_FAILURE_LOGS = 10;

// WebView 에러/HTTP 응답을 원인별로 분류한다.
//   'offline'    : 기기 네트워크 자체가 끊김
//   'timeout'    : 학교 서버가 응답하지 않음 (혼잡·점검 가능성)
//   'server'     : 학교 서버가 5xx 반환 (학교 쪽 장애)
//   'notfound'   : 404 등 — 학교가 페이지 주소를 바꿨을 가능성
//   'unknown'    : 분류 불가
export function classifyLoginFailure({ code, description, statusCode } = {}) {
  const desc = String(description || '').toLowerCase();

  if (typeof statusCode === 'number') {
    if (statusCode >= 500) return 'server';
    if (statusCode === 404 || statusCode === 410) return 'notfound';
  }
  if (desc.includes('internet') || desc.includes('offline') || desc.includes('not connected')) {
    return 'offline';
  }
  if (desc.includes('timed out') || desc.includes('timeout')) return 'timeout';
  // iOS NSURLErrorNotConnectedToInternet = -1009, NSURLErrorTimedOut = -1001
  if (code === -1009) return 'offline';
  if (code === -1001) return 'timeout';
  return 'unknown';
}

// 분류 결과 → 사용자에게 보여줄 문구(일본어)
// 핵심: "앱 문제가 아니라 학교 서버 문제일 수 있다"는 점을 분명히 말해준다.
export function getFailureCopy(kind) {
  switch (kind) {
    case 'offline':
      return {
        title: 'インターネットに接続できません',
        message: '通信環境をご確認のうえ、もう一度お試しください。',
      };
    case 'timeout':
      return {
        title: '学校のサイトが応答しません',
        message: 'アクセスが集中している可能性があります。\n少し時間をおいてからお試しください。',
      };
    case 'server':
      return {
        title: '学校のサーバーで問題が発生しています',
        message: 'アプリ側の問題ではありません。\nしばらくしてからもう一度お試しください。',
      };
    case 'notfound':
      return {
        title: 'ページが見つかりません',
        message: '学校側でページが変更された可能性があります。\n解決しない場合はお問い合わせください。',
      };
    default:
      return {
        title: '接続エラー',
        message: 'ページに接続できませんでした。\nインターネット接続を確認してください。',
      };
  }
}

// 기록 1건을 만든다 (민감 정보 없음: 호스트·분류·시각만)
export function buildFailureEntry({ url, kind, statusCode, at = new Date() }) {
  const host = (String(url || '').match(/^https?:\/\/([^/?#]+)/) || [])[1] ?? '';
  return {
    host,
    kind,
    statusCode: typeof statusCode === 'number' ? statusCode : null,
    at: at.toISOString(),
  };
}

// 기존 기록에 새 기록을 더한다 (최신이 앞, 최대 MAX_FAILURE_LOGS건)
export function appendFailureLog(existing, entry) {
  const list = Array.isArray(existing) ? existing : [];
  return [entry, ...list].slice(0, MAX_FAILURE_LOGS);
}

// AsyncStorage에 기록 (실패해도 앱 동작에 영향 주지 않음)
export async function recordLoginFailure(storage, entry) {
  try {
    const raw = await storage.getItem(LOGIN_FAILURE_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const next = appendFailureLog(parsed, entry);
    await storage.setItem(LOGIN_FAILURE_LOG_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

// 기록 읽기
export async function readLoginFailures(storage) {
  try {
    const raw = await storage.getItem(LOGIN_FAILURE_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
