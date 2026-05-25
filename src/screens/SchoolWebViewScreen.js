import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../constants/colors';
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
import { getCurrentTerm } from '../utils/timetable';

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

// 범용 학교 사이트 WebView 화면 (kaede-i, 포털 등 재사용)
// route.params: { url, title, autoLogin? }
//
// autoLogin=true 이면 A방식 자동 로그인 활성:
//   - 저장된 ID/PW가 있으면 로그인 폼에 자동 입력 + 제출
//   - 저장된 게 없으면 사용자가 직접 로그인 → 입력값을 캡처해 암호화 저장(다음부터 자동)
//   ※ ID/PW는 기기 내 AES-256 저장, 서버 전송 없음
export default function SchoolWebViewScreen({ navigation, route }) {
  const { url, title, autoLogin = false } = route.params ?? {};
  const { session } = useAuth();
  // 시간표 파싱에 쓸 학교 id (카에데=국사관 → 전용 파서로 라우팅)
  const universityId = getUniversityInfo(session?.user?.email)?.id;
  const cookieKey = useMemo(() => cookieKeyForUrl(url), [url]);
  const credKey = useMemo(() => credKeyForUrl(url), [url]);
  const webViewRef = useRef(null);
  const autoFilledRef = useRef(false); // 자동 입력 1회만 시도
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url ?? ''); // 현재 보고 있는 페이지 URL
  const [ready, setReady] = useState(false);
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
  };

  // MY時間割 페이지일 때만 추출 버튼 노출 (카에데 진입 직후/다른 페이지에서는 숨김)
  const isTimetablePage = currentUrl.toLowerCase().includes('mytimetable');

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
      }
    } catch (_) {}
  };

  // 추출된 셀 → 파서 라우터로 해석 → 확인 후 미리보기 화면으로
  const handleExtractedCells = (msg) => {
    if (msg.error) {
      Alert.alert('読み込みエラー', '時間割の読み込みに失敗しました。もう一度お試しください');
      return;
    }
    const parseResult = parseTimetable({
      universityId,
      payload: { kind: 'kaedeCells', data: msg.cells, term: getCurrentTerm() },
    });
    const count = parseResult.parsed.length;
    if (count === 0) {
      Alert.alert('お知らせ', '今学期の授業が見つかりませんでした');
      return;
    }
    Alert.alert(
      '時間割の取り込み',
      `${count}件の授業が見つかりました。\n確認画面で追加する授業を選べます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '進む',
          onPress: () =>
            // 옵션B: 모달을 닫으며 시간표 탭의 미리보기 화면으로 결과 전달
            navigation.navigate('MainTab', {
              screen: 'Timetable',
              params: { screen: 'BulkAddPreview', params: { parseResult } },
            }),
        },
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
          <ActivityIndicator size="small" color={colors.primary} />
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

      {/* 시간표 가져오기 버튼 — MY時間割 페이지에서만 노출 */}
      {ready && isTimetablePage && (
        <TouchableOpacity
          style={styles.extractFab}
          onPress={() => webViewRef.current?.injectJavaScript(KAEDE_EXTRACT_JS)}
          activeOpacity={0.85}
        >
          <Text style={styles.extractFabText}>📥 時間割を取り込む</Text>
        </TouchableOpacity>
      )}
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
  // [Phase B 임시] 추출 플로팅 버튼
  extractFab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
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
