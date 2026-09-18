import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { UNIPAS_USER_AGENT } from '../constants/manaba';
import UnofficialNotice from '../components/UnofficialNotice';
import { colors } from '../constants/colors';
import LoadingDots from '../components/LoadingDots';
import {
  DISABLE_AUTOCAPS_JS,
  saveCookies,
  getSavedCookieHeader,
  restoreCookies,
  clearCookies,
  cookieKeyForUrl,
  credKeyForUrl,
  getCredentials,
  saveCredentials,
  clearCredentials,
  buildAutoFillJS,
  CAPTURE_CREDENTIALS_JS,
} from '../utils/schoolCookies';
import { useAuth } from '../lib/AuthProvider';
import { getUniversityInfo } from '../utils/university';
import { parseTimetable } from '../utils/timetableRouter';
import { getCurrentTerm, termLabel } from '../utils/timetable';
import { shouldShowExtractButton } from '../utils/timetableImport';
import { buildKaedeCellId, buildSyllabusClickJS } from '../utils/syllabusLink';

// 카에데 MY時間割 셀 추출 스크립트
// 각 수업 칸은 <td id="Cell{열}_{교시}_{Spring|Autumn}" class="cell"> 구조.
// id(요일·교시·학기) + 과목명(.lecture_name) + 교수명(教員：…)만 뽑아 배열로 보낸다.
// 셀 id를 그대로 보내고 요일/교시 해석은 RN의 parseKaedeTimetable이 담당.
const KAEDE_EXTRACT_JS = `(function(){
  try {
    var cells = document.querySelectorAll('td.cell');
    var out = [];
    for (var i = 0; i < cells.length; i++) {
      var td = cells[i];
      var nameEl = td.querySelector('.lecture_name');
      if (!nameEl) continue;                       // 빈 칸(공강) 제외
      var name = (nameEl.textContent || '').trim();
      if (!name) continue;
      var prof = '';
      var hides = td.querySelectorAll('.mobile-hide');
      for (var j = 0; j < hides.length; j++) {
        var t = (hides[j].textContent || '').trim();
        if (t.indexOf('教員：') === 0) prof = t.replace('教員：', '').trim();
      }
      out.push({ id: td.id, name: name, professor: prof });
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'kaedeCells', cells: out, url: location.href }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'kaedeCells', error: String(e) }));
  }
  true;
})();`;

// #3: 현재 페이지가 로그인 페이지인지(비밀번호 입력칸 유무)만 알려주는 프로브.
// 로그인 페이지를 거친 뒤 비밀번호 칸이 없는 페이지에 도착하면 = 로그인 완료로 보고
// MY時間割 페이지로 자동 이동시키는 판단에 쓴다. (URL 형태에 의존하지 않아 견고)
const PROBE_LOGIN_STATE_JS = `(function(){
  try {
    var hasPw = !!document.querySelector('input[type=password]');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pageProbe', hasPassword: hasPw, url: location.href }));
  } catch (e) {}
  true;
})();`;

// 범용 학교 사이트 WebView 화면 (kaede-i, 포털 등 재사용)
// route.params: { url, title, autoLogin?, forTimetableImport?, syllabusTarget? }
//
// syllabusTarget={ day, period, term } 이면 과목별 시라바스 모드:
//   MY時間割 페이지에 도착하는 즉시 해당 셀의 シラバス 링크(onclick=OpenSyllabusWindow(uid))에서
//   uid를 읽어 같은 WebView 안에서 /Syllabus/SyllabusViewVer2.aspx?uid=… 로 1회 이동한다.
//   (원래 링크는 window.open 새 창이라 WebView에서 그냥 클릭하면 안 열림 — utils/syllabusLink.js 참조)
//
// autoLogin=true 이면 A방식 자동 로그인 활성:
//   - 저장된 ID/PW가 있으면 로그인 폼에 자동 입력 + 제출
//   - 저장된 게 없으면 사용자가 직접 로그인 → 입력값을 캡처해 암호화 저장(다음부터 자동)
//   ※ ID/PW는 기기 내 AES-256 저장, 서버 전송 없음
export default function SchoolWebViewScreen({ navigation, route }) {
  const {
    url, title, autoLogin = false, forTimetableImport = false, syllabusTarget = null,
  } = route.params ?? {};
  // 과목별 시라바스 모드: 클릭할 kaede 셀 id (형식이 안 맞으면 null → 일반 모드처럼 동작)
  const syllabusCellId = syllabusTarget ? buildKaedeCellId(syllabusTarget) : null;
  // 로그인 후 MY時間割 페이지 도착을 감시해야 하는 경로인지(일괄취급 / 과목별 시라바스)
  const wantsTimetablePage = forTimetableImport || !!syllabusCellId;
  const { session } = useAuth();
  // 시간표 파싱에 쓸 학교 id (카에데=국사관 → 전용 파서로 라우팅)
  const universityId = getUniversityInfo(session?.user?.email)?.id;
  const cookieKey = useMemo(() => cookieKeyForUrl(url), [url]);
  const credKey = useMemo(() => credKeyForUrl(url), [url]);
  const webViewRef = useRef(null);
  const autoFilledRef = useRef(false); // 자동 입력 1회만 시도
  // #3: 로그인 후 MY時間割 페이지로 자동 이동시키기 위한 상태
  const sawLoginPageRef = useRef(false);          // 비밀번호 칸이 있는 로그인 페이지를 본 적 있는지
  const redirectedToTimetableRef = useRef(false); // 시간표 페이지로 1회만 자동 이동
  const syllabusClickedRef = useRef(false);       // 과목별 시라바스 링크 자동 클릭은 1회만
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url ?? ''); // 현재 보고 있는 페이지 URL
  const [ready, setReady] = useState(false);
  // 로그인 상태 추적: 초기 URL(로그인 페이지)에서 다른 URL로 이동하면 로그인 완료로 판단
  // 한 번 true가 되면 되돌아오지 않음 (면책 고지 재표시 방지)
  const [loggedIn, setLoggedIn] = useState(false);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [creds, setCreds] = useState(null);

  // 마운트 시: 쿠키 복원(보조) + 저장된 자격증명 로드 → 그 후 WebView 렌더
  useEffect(() => {
    let mounted = true;
    (async () => {
      await restoreCookies(url, cookieKey);
      const header = await getSavedCookieHeader(cookieKey);
      const c = autoLogin ? await getCredentials(credKey) : null;
      if (mounted) {
        setCookieHeader(header || null);
        setCreds(c);
        setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url, cookieKey, credKey, autoLogin]);

  const handleNavStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setCurrentUrl(navState.url || '');
    // 초기 URL과 다른 URL로 이동하면 로그인 완료로 판단 (단방향)
    if (!loggedIn && navState.url && navState.url !== url) {
      setLoggedIn(true);
    }
  };

  // 추출 버튼 노출 여부 — 시간표 임포트 경로 + (로그인됨 또는 시간표 페이지).
  // 기기별 자동이동 실패로 URL이 안 맞아도, 로그인만 됐으면 버튼을 띄워 직접 열고
  // 누를 수 있게 한다. (판단 로직은 utils/timetableImport에서 테스트)
  const showExtractButton = shouldShowExtractButton({ forTimetableImport, loggedIn, currentUrl });

  // WebView 내부 페이지 뒤로가기 (잘못 들어갔을 때 한 페이지 복귀)
  const handleWebBack = () => {
    if (canGoBack) webViewRef.current?.goBack();
  };

  // 모달 전체 닫기 — 터치 한 번에 시간표/홈으로 복귀
  const handleClose = () => {
    navigation.goBack();
  };

  // 사용자가 직접 로그인할 때 입력한 ID/PW 캡처 → 암호화 저장
  // + 카에데 시간표 셀 추출 결과 수신 → 파싱 → 확인 → 미리보기 화면으로 이동
  const handleMessage = async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'credentials' && msg.pw) {
        await saveCredentials(credKey, msg.id, msg.pw);
        setCreds({ id: msg.id, pw: msg.pw });
      } else if (msg.type === 'kaedeCells') {
        handleExtractedCells(msg);
      } else if (msg.type === 'pageProbe') {
        handlePageProbe(msg);
      } else if (msg.type === 'syllabusClick') {
        handleSyllabusClickResult(msg);
      }
    } catch (_) {}
  };

  // #3: 로그인 완료를 감지해 MY時間割 페이지로 자동 이동
  //   - 비밀번호 칸이 있으면 로그인 페이지 → 아직 로그인 전(플래그만 기록)
  //   - 로그인 페이지를 거친 뒤, 비밀번호 칸 없는 페이지에 도착했는데 그게 시간표 페이지가
  //     아니라면 → 사용자가 직접 메뉴를 찾지 않아도 되게 MY時間割로 1회 자동 이동
  //   - 과목별 시라바스 모드면 시간표 페이지 도착 즉시 해당 셀의 시라바스 uid로 1회 이동
  //     (이동 후 시라바스 페이지에서는 더 이상 개입하지 않음)
  const handlePageProbe = (msg) => {
    if (!wantsTimetablePage) return;
    if (syllabusClickedRef.current) return; // 시라바스 클릭 이후 페이지들은 손대지 않음
    if (msg.hasPassword) {
      sawLoginPageRef.current = true; // 로그인 페이지 도착 (아직 로그인 전)
      return;
    }
    const here = (msg.url || '').toLowerCase();
    if (here.includes('mytimetable')) {
      // 시간표 페이지 도착. 일괄취급이면 추출 버튼이 뜨므로 그대로 두고,
      // 과목별 시라바스면 해당 셀의 링크를 대신 눌러준다.
      if (syllabusCellId) {
        syllabusClickedRef.current = true;
        webViewRef.current?.injectJavaScript(buildSyllabusClickJS(syllabusCellId));
      }
      return;
    }
    if (sawLoginPageRef.current && !redirectedToTimetableRef.current) {
      redirectedToTimetableRef.current = true;
      webViewRef.current?.injectJavaScript(`location.href=${JSON.stringify(url)}; true;`);
    }
  };

  // 과목별 시라바스 자동 클릭 결과. 실패해도 시간표 페이지는 그대로 보이므로
  // 사용자가 직접 シラバス를 누를 수 있게 안내만 한다.
  const handleSyllabusClickResult = (msg) => {
    if (msg.ok) return;
    Alert.alert(
      'お知らせ',
      'この授業のシラバスリンクが見つかりませんでした。\n時間割の授業欄にある「シラバス」を直接タップしてください。'
    );
  };

  // 추출된 셀 → 파서 라우터로 해석 → 확인 후 미리보기 화면으로
  const handleExtractedCells = (msg) => {
    if (msg.error) {
      Alert.alert('読み込みエラー', '時間割の読み込みに失敗しました。もう一度お試しください');
      return;
    }
    // 학기 필터 없이 전부 해석 → 春期/秋期 건수를 세어 사용자가 고르게 한다
    // (kaede-i MY時間割은 교시마다 春期/秋期 2행이라 한 페이지에 두 학기가 같이 있다)
    const all = parseTimetable({
      universityId,
      payload: { kind: 'kaedeCells', data: msg.cells },
    });
    const byTerm = (term) => ({
      parsed: all.parsed.filter((it) => it.term === term),
      unparsed: all.unparsed,
    });
    const springCount = byTerm('spring').parsed.length;
    const fallCount = byTerm('fall').parsed.length;
    const count = all.parsed.length;
    if (count === 0) {
      // 추출 0건 → 시간표 페이지가 아닐 수 있으니 먼저 그 페이지를 열도록 유도.
      // (기기별 자동이동 실패로 다른 페이지에서 눌렀을 수 있음)
      Alert.alert(
        'お知らせ',
        '授業が見つかりませんでした。\n「MY時間割」ページを開いてから、もう一度「取り込む」を押してください。',
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }
    // 옵션B: 모달을 닫으며 시간표 탭의 미리보기 화면으로 선택한 학기 결과만 전달
    const goPreview = (term) =>
      navigation.navigate('MainTab', {
        screen: 'Timetable',
        params: {
          screen: 'BulkAddPreview',
          params: { parseResult: byTerm(term), defaultTerm: term },
        },
      });
    const current = getCurrentTerm();
    const label = (term, n) =>
      `${termLabel(term)} (${n}件)${term === current ? ' ・今学期' : ''}`;
    Alert.alert(
      '時間割の取り込み',
      `${count}件の授業が見つかりました。\nどの学期の時間割を取り込みますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: label('spring', springCount), onPress: () => goPreview('spring') },
        { text: label('fall', fallCount), onPress: () => goPreview('fall') },
      ]
    );
  };

  // 페이지 로드 완료: 쿠키 저장 + (autoLogin이면) 캡처 hook + 자동 입력
  const handleLoadEnd = async () => {
    setLoading(false);
    await saveCookies(url, cookieKey);
    if (!autoLogin) return;
    // 항상 캡처 hook 주입 (수동/재로그인 시 자격증명 갱신)
    webViewRef.current?.injectJavaScript(CAPTURE_CREDENTIALS_JS);
    // #3: 시간표 일괄취급/과목별 시라바스 경로에서만, 로그인 완료 후 MY時間割 자동 이동(및 시라바스 클릭)을 위해 로그인 상태 프로브 실행
    if (wantsTimetablePage) {
      webViewRef.current?.injectJavaScript(PROBE_LOGIN_STATE_JS);
    }
    // 저장된 자격증명이 있으면 1회 자동 입력 + 제출
    if (creds && creds.pw && !autoFilledRef.current) {
      autoFilledRef.current = true;
      webViewRef.current?.injectJavaScript(buildAutoFillJS(creds.id, creds.pw));
    }
  };

  // 로그아웃: 쿠키 + 저장된 자격증명 삭제 후 로그인 페이지로
  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか?\n（保存したログイン情報も削除されます）',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            await clearCookies(url, cookieKey);
            if (autoLogin) await clearCredentials(credKey);
            setCreds(null);
            setCookieHeader(null);
            autoFilledRef.current = false;
            webViewRef.current?.reload();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더: [閉じる + ‹뒤로] [제목] [ログアウト] */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={handleClose} style={styles.textBtn}>
            <Text style={styles.closeText}>閉じる</Text>
          </TouchableOpacity>
          {canGoBack && (
            <TouchableOpacity onPress={handleWebBack} style={styles.headerBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title ?? 'ページ'}
        </Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <TouchableOpacity onPress={handleLogout} style={styles.textBtn}>
            <Text style={styles.logoutText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 로딩 인디케이터 */}
      {(loading || !ready) && (
        <View style={styles.loadingBar}>
          <LoadingDots size={7} />
        </View>
      )}

      {/* 준비 완료 후에만 WebView 렌더 */}
      {ready && (
        <WebView
          ref={webViewRef}
          source={{
            uri: url,
            headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          }}
          style={styles.webView}
          applicationNameForUserAgent={UNIPAS_USER_AGENT}
          injectedJavaScriptBeforeContentLoaded={DISABLE_AUTOCAPS_JS}
          onNavigationStateChange={handleNavStateChange}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={() => {
            setLoading(false);
            Alert.alert(
              '接続エラー',
              'ページに接続できませんでした。\nインターネット接続を確認してください。'
            );
          }}
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
        />
      )}

      {/* 시간표 가져오기 버튼 — 로그인 후 노출 (자동이동 실패 대비) */}
      {ready && showExtractButton && (
        <TouchableOpacity
          style={styles.extractFab}
          onPress={() => webViewRef.current?.injectJavaScript(KAEDE_EXTRACT_JS)}
          activeOpacity={0.85}
        >
          <Text style={styles.extractFabText}>📥 時間割を取り込む</Text>
        </TouchableOpacity>
      )}

      {/* 비공식 앱 면책 고지 — 로그인 전(처음 로그인 화면)에만 표시, 로그인 후 숨김 */}
      {!loggedIn && <UnofficialNotice />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 32,
    alignItems: 'center',
  },
  headerSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSideRight: {
    justifyContent: 'flex-end',
  },
  closeText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  backIcon: {
    fontSize: 28,
    color: colors.primary,
    lineHeight: 32,
  },
  textBtn: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loadingBar: {
    height: 3,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  webView: {
    flex: 1,
  },
  // 시간표 추출 플로팅 버튼
  extractFab: {
    position: 'absolute',
    right: 16,
    bottom: 72, // 하단 면책 고지 바와 겹치지 않도록 올림
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  extractFabText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
