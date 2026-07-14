// 홈 화면 manaba 공지 미리보기 카드
//
// 화면에 안 보이는 WebView(height 0)로 manaba 홈을 열어 저장된 쿠키로 로그인
// 상태를 복원하고, PARSE_NOTICES_JS로 공지를 파싱해 카드로 보여준다.
// 사용자는 manaba에 직접 들어가지 않아도 새 공지를 확인할 수 있고,
// 탭하면 해당 공지의 manaba 원본으로 바로 이동한다.
//
// 핵심 원칙: 비밀번호 서버 저장 ❌ — 기존 manaba 쿠키 영속 방식만 재사용.
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Swipeable } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, shadow } from '../constants/spacing';
import { NOTICE_COACH_SHOWN_KEY } from '../constants/onboardingFlags';
import { parseCoachFlag, shouldShowCoachOnTap } from '../utils/noticeCoach';
import { MANABA_LOGIN_URL, MANABA_HOME_URL, PARSE_NOTICES_JS, UNIPAS_USER_AGENT } from '../constants/manaba';
import { getSavedCookieHeader, cookieKeyForUrl } from '../utils/schoolCookies';
import { getCachedNotices, setCachedNotices, getDismissedKeys, addDismissedKey, noticeKey } from '../utils/manabaCache';
import { mergeNotices, countUnreadPush } from '../utils/manabaMerge';
import { getAutoReloginState } from '../utils/manabaSession';
import { fetchUnreadNotices, markNoticeAsRead, markAllAsRead } from '../utils/manabaNotices';
import { summarizeManabaMail } from '../utils/manabaMailSummary';
import { openManaba } from '../utils/mailOnboarding';
import { useAuth } from '../lib/AuthProvider';

const PREVIEW_COUNT = 3; // 카드에 보여줄 공지 개수

// 공지 1건 = 스와이프 카드.
// 스와이프로 열린 상태(openRef=true)에서는 카드 탭을 무시하고 닫기만 한다.
// → 스와이프했을 때 마나바 상세로 잘못 들어가는 문제 방지.
function NoticeRow({ item, onDismiss, onPressItem }) {
  const swipeRef = useRef(null);
  const openRef = useRef(false);
  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      onSwipeableWillOpen={() => { openRef.current = true; }}
      onSwipeableWillClose={() => { openRef.current = false; }}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.swipeAction}
          activeOpacity={0.8}
          onPress={() => { swipeRef.current?.close(); onDismiss(item); }}
        >
          <Text style={styles.swipeActionText}>既読</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={styles.noticeCard}
        activeOpacity={0.7}
        onPress={() => {
          // 스와이프로 열려 있으면 화면 전환 대신 닫기만
          if (openRef.current) { swipeRef.current?.close(); return; }
          onPressItem(item);
        }}
      >
        <View style={styles.noticeRow}>
          {/* 푸시 출처는 🔴 점, WebView는 마커 없음 */}
          {item._source === 'push' && <View style={styles.unreadDot} />}
          <View style={styles.noticeBody}>
            {/* 과목명 라인: 종류 아이콘 + 과목명 */}
            {!!item.board && (
              <Text style={styles.boardTag} numberOfLines={1}>
                {item._type?.icon ? `${item._type.icon} ` : ''}{item.board}
              </Text>
            )}
            {/* 요약(또는 제목) */}
            <Text style={styles.noticeTitle} numberOfLines={2}>{item.title}</Text>
            {/* 메타 라인: 마감 / 첨부 / 날짜 */}
            <View style={styles.metaRow}>
              {!!item._deadline && (
                <Text style={styles.metaDeadline}>⏰ ~{item._deadline}</Text>
              )}
              {item._hasAttach && <Text style={styles.metaAttach}>📎 첨부</Text>}
              {!!item.date && <Text style={styles.noticeDate}>{item.date}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// 홈에서 공지 카드를 처음 탭했을 때 1회만 뜨는 사용법 안내 모달.
// 스와이프 삭제·탭 이동을 간단한 아이콘 카드로 알려준다.
const COACH_POINTS = [
  {
    icon: 'arrow-back',
    title: '左にスワイプで既読',
    body: 'カードを左にスワイプすると、そのお知らせを既読にできます。',
  },
  {
    icon: 'open-outline',
    title: 'タップで原文へ',
    body: 'カードをタップすると、manabaの元のお知らせがそのまま開きます。',
  },
  {
    icon: 'list',
    title: '一覧でも同じ操作',
    body: '「すべて見る」の一覧でも、左スワイプで既読にできます。',
  },
];

function NoticeCoachModal({ visible, onConfirm, onDismiss }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={coach.overlay}>
        <View style={coach.card}>
          <View style={coach.iconCircle}>
            <Ionicons name="hand-left" size={28} color={colors.primary} />
          </View>
          <Text style={coach.heading}>お知らせの使い方</Text>
          <View style={coach.points}>
            {COACH_POINTS.map((p) => (
              <View key={p.title} style={coach.point}>
                <View style={coach.pointIcon}>
                  <Ionicons name={p.icon} size={18} color={colors.primary} />
                </View>
                <View style={coach.pointText}>
                  <Text style={coach.pointTitle}>{p.title}</Text>
                  <Text style={coach.pointBody}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={coach.button} activeOpacity={0.8} onPress={onConfirm}>
            <Text style={coach.buttonText}>わかりました</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ManabaNoticePreview({ navigation, onCountsChange }) {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);          // WebView 파싱 결과 (Phase 1)
  const [dbNotices, setDbNotices] = useState([]);      // manaba_notices 안 읽음 (Phase 3)
  const [dismissedKeys, setDismissedKeys] = useState([]); // 사용자가 既読 처리한 WebView 공지 식별자
  const [cookieHeader, setCookieHeader] = useState(null);
  const [cookieChecked, setCookieChecked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // 화면 재진입 시 WebView 재마운트용
  // 숨은 WebView가 로그인 페이지로 튕긴 경우 = manaba 세션 만료 감지 플래그.
  // 만료 시에는 자동 재로그인을 하지 않고(봇 탐지 회피) "재로그인 필요" 안내만 표시.
  const [sessionExpired, setSessionExpired] = useState(false);
  const cookieKey = useRef(cookieKeyForUrl(MANABA_LOGIN_URL)).current;

  // 첫 탭 사용법 코치 모달 상태.
  //  coachShown: null=플래그 로드 전 / false=아직 안 봄 / true=이미 봄
  //  pendingItem: 코치를 먼저 띄우느라 대기 중인, 사용자가 탭한 공지
  const [coachShown, setCoachShown] = useState(null);
  const [pendingItem, setPendingItem] = useState(null);

  // 마운트 시 1회 플래그 로드 (한 번만 표시하기 위함)
  useEffect(() => {
    AsyncStorage.getItem(NOTICE_COACH_SHOWN_KEY)
      .then((v) => setCoachShown(parseCoachFlag(v)))
      .catch(() => setCoachShown(true)); // 읽기 실패 시엔 굳이 안 띄움
  }, []);

  // 화면에 들어올 때마다: 캐시/DB 로드 + 쿠키 확인 + 숨은 WebView 새로고침
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // 캐시 내용을 항상 반영 (로그아웃으로 캐시가 비면 화면도 비워짐)
        const cached = await getCachedNotices();
        if (active) setNotices(cached?.notices || []);

        // 既読(숨김) 처리된 WebView 공지 식별자 로드 — 화면에서 가리는 데 사용
        const dismissed = await getDismissedKeys();
        if (active) setDismissedKeys(dismissed);

        // 푸시로 들어온 공지(안 읽음만) 로드 — Phase 3 데이터
        if (user?.id) {
          const unread = await fetchUnreadNotices(user.id);
          if (active) setDbNotices(unread);
        } else if (active) {
          setDbNotices([]);
        }

        const header = await getSavedCookieHeader(cookieKey);
        if (!active) return;
        setCookieHeader(header || null);
        setCookieChecked(true);
        // 화면 재진입 시 만료 플래그 리셋 — 사용자가 manaba 탭에서 재로그인하고
        // 돌아왔을 수 있으므로 새 쿠키로 다시 시도해본다.
        setSessionExpired(false);
        if (header) setReloadKey((k) => k + 1); // 쿠키 있을 때만 백그라운드 파싱
      })();
      return () => {
        active = false;
      };
    }, [cookieKey, user?.id])
  );

  // 숨은 WebView 파싱 결과 수신
  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'notices') return;
      // 쿠키가 만료돼 로그인 페이지로 튕긴 경우 → 만료 플래그 set + 캐시 유지.
      // 자동 재로그인은 manaba 탭에서 사용자 행동으로 트리거 (봇 탐지 회피)
      if (msg.currentUrl && msg.currentUrl.includes('/ct/login')) {
        setSessionExpired(true);
        return;
      }
      const data = Array.isArray(msg.data) ? msg.data : [];
      if (data.length === 0) {
        // 홈(/ct/home)이 정상 로드됐는데 공지가 0건 = 마나바에서 직접 모두
        // 읽음/삭제한 상태 → 홈 캐시도 비워 동기화(버그 ②).
        // 그 외(로그인 리다이렉트·전환 중 등 애매한 페이지)면 캐시 유지.
        if (msg.currentUrl && msg.currentUrl.includes('/ct/home')) {
          setNotices([]);
          setCachedNotices([]);
        }
        return;
      }
      setNotices(data);
      setCachedNotices(data);
    } catch {
      // 파싱 실패는 조용히 무시 (홈 화면은 그대로 유지)
    }
  };

  // DB(푸시) 공지를 WebView 캐시 공지와 동일한 형태({title, href, board, date})로 정규화.
  // 이후 dedup + 렌더 로직이 한 가지 형태만 다루도록 통일한다.
  // body_html이 있으면 summarizeManabaMail로 과목/요약/마감/첨부까지 함께 채운다.
  const normalizeDbNotice = (n) => {
    const s = summarizeManabaMail({
      subject: n.subject,
      sender: n.sender,
      bodyHtml: n.body_html,
      courseHint: n.course_hint,
    });
    return {
      title: s.summary || n.subject || '(無題)',
      href: n.notice_url || null,
      board: s.courseName || n.course_hint || null,
      date: n.received_at ? n.received_at.slice(0, 10) : null,
      _source: 'push',     // 🔴 마커 표시용
      _id: n.id,           // markNoticeAsRead 호출에 필요
      _type: s.type,       // {icon, label}
      _deadline: s.deadline,
      _hasAttach: s.hasAttach,
    };
  };

  // 두 데이터 소스 병합 — URL 기준 dedup + 既読(삭제) 제외 (순수함수, 테스트됨)
  // push·web 모두 dismissedKeys로 걸러 "삭제 후 부활"을 막는다(버그 ①).
  const merged = mergeNotices(dbNotices.map(normalizeDbNotice), notices, dismissedKeys);
  // 배지 숫자는 merged의 push 개수 = 목록 화면 항목 수와 항상 일치(버그 ③)
  const unreadCount = countUnreadPush(merged);

  // 부모(HomeScreen 히어로 카드)에 카운트 보고 — 미리보기 배지와 숫자를 동일하게 맞춤
  //  unread: 안 읽은 푸시 수 / total: 현재 공지 전체(푸시+WebView 캐시, 중복 제거)
  useEffect(() => {
    onCountsChange?.({ unread: unreadCount, total: merged.length });
  }, [unreadCount, merged.length, onCountsChange]);

  const goToDetail = (item) => {
    // 탭 = 확인 → 읽음/숨김 처리 후 원본으로 이동 (push·web 공통, 목록에서 즉시 제거)
    dismissNotice(item);
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeDetail',
      params: { url: item.href, title: item.title },
    });
  };

  // 카드 탭 진입점: 최초 1회는 사용법 코치 모달을 먼저 띄우고, 확인 후 원본으로 이동.
  // coachShown이 아직 로드 전(null)이면 굳이 붙잡지 않고 바로 이동(짧은 마운트 직후 레이스 대비).
  const handleNoticePress = (item) => {
    if (shouldShowCoachOnTap(coachShown)) {
      setPendingItem(item);
      return;
    }
    goToDetail(item);
  };

  // 코치 모달 "확인" → 1회 플래그 저장 후, 원래 열려던 공지로 이동
  const handleCoachConfirm = () => {
    setCoachShown(true);
    AsyncStorage.setItem(NOTICE_COACH_SHOWN_KEY, '1').catch(() => {});
    const item = pendingItem;
    setPendingItem(null);
    if (item) goToDetail(item);
  };

  // Android 뒤로가기 등으로 코치를 취소 — 이동/저장하지 않고 닫기만 (다음 탭에 다시 안내)
  const handleCoachDismiss = () => setPendingItem(null);

  // 既読(삭제) 처리 — 화면에서 즉시 제거하고 영구 반영한다.
  //  · 공통: 식별자를 로컬 숨김 목록에 저장 → 다시 파싱/재조회돼도 안 보이게
  //          (push의 DB 읽음 처리가 실패해도 홈에서 부활하지 않음 — 버그 ①)
  //  · push: 추가로 manaba_notices.is_read = true (DB) 반영
  const dismissNotice = (item) => {
    const key = noticeKey(item);
    setDismissedKeys((prev) => (prev.includes(key) ? prev : [key, ...prev]));
    addDismissedKey(key);
    if (item._source === 'push' && item._id) {
      setDbNotices((prev) => prev.filter((n) => n.id !== item._id));
      markNoticeAsRead(item._id);
    }
  };

  // "すべて見る" — 홈과 동일한 병합 목록(push + web)을 넘긴다.
  // notices(WebView)만 넘기면 홈 카운트가 push 공지일 때 목록이 비는 문제(버그 ③) 방지.
  const goToList = () =>
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeList',
      params: { notices: merged },
    });

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    Alert.alert(
      '全て既読にしますか?',
      `${unreadCount}件の通知を既読にします。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '既読にする',
          style: 'default',
          onPress: async () => {
            if (!user?.id) return;
            setDbNotices([]); // 옵티미스틱 업데이트
            await markAllAsRead(user.id);
          },
        },
      ],
    );
  };

  // 만료 안내 메시지 — 글로벌 정책 상태에 따라 분기.
  // - 평소: 재로그인 유도
  // - MAX 실패 후 쿨다운 중: 시간 경과 후 다시 시도하라고 안내
  const expiredMessage = () => {
    const { failureCount, lastFailureAt, cooldownMs } = getAutoReloginState();
    const inCooldown =
      failureCount > 0 && Date.now() - lastFailureAt < cooldownMs;
    if (inCooldown) {
      return 'しばらく経ってから再度お試しください';
    }
    return 'タップして再ログインしてください';
  };

  // 숨은 WebView (쿠키 있을 때만): 화면 밖에서 manaba 홈을 파싱
  const hiddenWebView =
    cookieHeader != null ? (
      <WebView
        key={reloadKey}
        source={{ uri: MANABA_HOME_URL, headers: { Cookie: cookieHeader } }}
        applicationNameForUserAgent={UNIPAS_USER_AGENT}
        injectedJavaScript={PARSE_NOTICES_JS}
        onMessage={handleMessage}
        style={styles.hiddenWebView}
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        // 사용자에게 보이지 않도록 화면 밖으로
        pointerEvents="none"
      />
    ) : null;

  // 1) 병합된 공지가 있으면 카드 표시 (DB 푸시 + WebView 캐시)
  if (merged.length > 0) {
    const top = merged.slice(0, PREVIEW_COUNT);
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>📢 manabaのお知らせ</Text>
            {/* 안 읽은 푸시 개수 배지 — 0이면 일반 카운트로 폴백 */}
            <View style={[styles.countBadge, unreadCount > 0 && styles.countBadgeUnread]}>
              <Text
                style={[styles.countBadgeText, unreadCount > 0 && styles.countBadgeTextUnread]}
              >
                {unreadCount > 0 ? unreadCount : merged.length}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead}>
                <Text style={styles.markAllRead}>既読 ✓</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={goToList}>
              <Text style={styles.seeAll}>すべて見る</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 만료 배너 — 캐시는 보이지만 새 공지는 못 받는 상태임을 알림 */}
        {sessionExpired && (
          <TouchableOpacity
            style={styles.expiredBanner}
            activeOpacity={0.7}
            onPress={() => openManaba(navigation)}
          >
            <Text style={styles.expiredBannerText}>
              ⚠️ ログインの有効期限が切れました。{expiredMessage()}
            </Text>
          </TouchableOpacity>
        )}

        {top.map((item, i) => (
          <NoticeRow
            key={item._id || item.href || i}
            item={item}
            onDismiss={dismissNotice}
            onPressItem={handleNoticePress}
          />
        ))}

        {hiddenWebView}
        <NoticeCoachModal
          visible={!!pendingItem}
          onConfirm={handleCoachConfirm}
          onDismiss={handleCoachDismiss}
        />
      </View>
    );
  }

  // 2-a) 쿠키는 있는데 세션 만료됨 → 재로그인 유도 카드
  if (sessionExpired) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📢 manabaのお知らせ</Text>
        <TouchableOpacity
          style={styles.emptyCard}
          activeOpacity={0.7}
          onPress={() => openManaba(navigation)}
        >
          <Text style={styles.emptyText}>
            ログインの有効期限が切れました。{'\n'}{expiredMessage()}
          </Text>
          <Text style={styles.emptyLink}>manabaを開く →</Text>
        </TouchableOpacity>
        {hiddenWebView}
      </View>
    );
  }

  // 2-b) 공지도 캐시도 없는데 쿠키도 없음 → 로그인 유도 카드
  if (cookieChecked && cookieHeader == null) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📢 manabaのお知らせ</Text>
        <TouchableOpacity
          style={styles.emptyCard}
          activeOpacity={0.7}
          onPress={() => openManaba(navigation)}
        >
          <Text style={styles.emptyText}>
            manabaにログインするとお知らせが表示されます
          </Text>
          <Text style={styles.emptyLink}>ログインする →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3) 쿠키는 있는데 아직 공지 없음 → 카드 없이 백그라운드 파싱만
  return hiddenWebView;
}

const styles = StyleSheet.create({
  // HomeScreen.js의 section/card 패턴과 동일한 토스 스타일
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  seeAll: {
    ...typography.caption,
    color: colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  markAllRead: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  countBadge: {
    backgroundColor: colors.primary + '18',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  countBadgeText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.primary,
  },
  // 안 읽은 푸시가 있을 때 강조 (빨강 배경)
  countBadgeUnread: {
    backgroundColor: '#FF3B30',
  },
  countBadgeTextUnread: {
    color: '#FFFFFF',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeBody: {
    flex: 1,
    gap: 3,
  },
  // 푸시 출처 표시 — 빨간 원형 점
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginTop: 6,
  },
  noticeCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 3,
  },
  // 스와이프 시 오른쪽에 나타나는 빨간 '既読' 버튼 (카드와 같은 높이·간격)
  swipeAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  swipeActionText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  boardTag: {
    ...typography.small,
    fontWeight: '600',
    color: colors.primary,
  },
  noticeTitle: {
    ...typography.body2,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  noticeDate: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  metaDeadline: {
    ...typography.small,
    fontWeight: '600',
    color: '#FF6B00', // 마감 강조 (오렌지)
  },
  metaAttach: {
    ...typography.small,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  // 화면 밖으로 빼서 사용자에게 안 보이게
  hiddenWebView: {
    width: 1,
    height: 1,
    position: 'absolute',
    top: -1000,
    left: -1000,
    opacity: 0,
  },
  // 만료 배너 — 공지 카드 위에 표시되는 경고
  expiredBanner: {
    backgroundColor: '#FFF7E6',
    borderWidth: 1,
    borderColor: '#FFD580',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  expiredBannerText: {
    ...typography.small,
    color: '#8C5800',
    lineHeight: 18,
  },
});

// ── 첫 탭 사용법 코치 모달 스타일 ──
const coach = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  points: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1 },
  pointTitle: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  pointBody: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.body2,
    color: colors.white,
    fontWeight: '700',
  },
});
