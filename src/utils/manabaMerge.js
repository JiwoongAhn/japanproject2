// 홈 화면 manaba 공지 병합 로직 (순수함수)
//
// 홈 공지 카드는 두 소스를 합쳐 보여준다:
//  · push : manaba_notices 테이블에서 온 공지(정규화 완료, 읽음 추적 O)
//  · web  : 숨은 WebView가 마나바 홈을 파싱한 공지(읽음 추적 X, 숨김 목록으로 관리)
//
// 이 파일은 "무엇을 화면에 보일지"만 계산하는 순수함수라 유닛 테스트가 쉽다.
// (AsyncStorage/네트워크 접근은 호출부에서 담당)
import { noticeKey } from './manabaCache';

// 두 소스를 병합해 최종 표시 목록을 만든다.
//  1) URL이 겹치는 web 공지는 제거 (같은 공지가 push로도 왔으면 push 우선)
//  2) 사용자가 이미 既読(삭제)한 공지는 push·web 모두 숨긴다
//     → push 공지도 dismissedKeys로 한 번 더 걸러 "삭제 후 부활"을 막는다.
//       (DB 읽음 처리(markNoticeAsRead)가 실패해도 로컬 숨김으로 방어)
//  3) 각 항목에 _source 마커를 붙여 렌더/삭제 분기에 쓴다.
// normalizedPush: normalizeDbNotice를 거친 push 공지 배열
// webNotices    : WebView 파싱 공지 배열({title, href, date, board})
// dismissedKeys : 既読 처리된 공지 식별자 문자열 배열
export function mergeNotices(normalizedPush = [], webNotices = [], dismissedKeys = []) {
  const dbUrls = new Set(normalizedPush.map((n) => n.href).filter(Boolean));
  const dismissed = new Set(dismissedKeys);

  const push = normalizedPush
    .map((n) => ({ ...n, _source: 'push' }))
    .filter((n) => !dismissed.has(noticeKey(n)));

  const web = webNotices
    .filter((n) => !n.href || !dbUrls.has(n.href))
    .map((n) => ({ ...n, _source: 'web' }))
    .filter((n) => !dismissed.has(noticeKey(n)));

  return [...push, ...web];
}

// 병합 결과에서 "안 읽은 푸시" 개수 (배지 표시용).
// merged에는 이미 dismissed가 제외돼 있으므로 여기서 세면 홈 카운트와
// 목록 화면의 실제 항목 수가 항상 일치한다(버그 ③ 방지).
export function countUnreadPush(merged = []) {
  return merged.filter((m) => m._source === 'push').length;
}
