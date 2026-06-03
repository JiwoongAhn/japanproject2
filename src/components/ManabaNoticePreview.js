// 홈 화면 manaba 공지 미리보기 카드
//
// 화면에 안 보이는 WebView(height 0)로 manaba 홈을 열어 저장된 쿠키로 로그인
// 상태를 복원하고, PARSE_NOTICES_JS로 공지를 파싱해 카드로 보여준다.
// 사용자는 manaba에 직접 들어가지 않아도 새 공지를 확인할 수 있고,
// 탭하면 해당 공지의 manaba 원본으로 바로 이동한다.
//
// 핵심 원칙: 비밀번호 서버 저장 ❌ — 기존 manaba 쿠키 영속 방식만 재사용.
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, shadow } from '../constants/spacing';
import { MANABA_LOGIN_URL, MANABA_HOME_URL, PARSE_NOTICES_JS } from '../constants/manaba';
import { getSavedCookieHeader, cookieKeyForUrl } from '../utils/schoolCookies';
import { getCachedNotices, setCachedNotices } from '../utils/manabaCache';
import { getAutoReloginState } from '../utils/manabaSession';
import { fetchUnreadNotices, markNoticeAsRead, markAllAsRead } from '../utils/manabaNotices';
import { summarizeManabaMail } from '../utils/manabaMailSummary';
import { useAuth } from '../lib/AuthProvider';

const PREVIEW_COUNT = 3; // 카드에 보여줄 공지 개수

export default function ManabaNoticePreview({ navigation }) {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);          // WebView 파싱 결과 (Phase 1)
  const [dbNotices, setDbNotices] = useState([]);      // manaba_notices 안 읽음 (Phase 3)
  const [cookieHeader, setCookieHeader] = useState(null);
  const [cookieChecked, setCookieChecked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // 화면 재진입 시 WebView 재마운트용
  // 숨은 WebView가 로그인 페이지로 튕긴 경우 = manaba 세션 만료 감지 플래그.
  // 만료 시에는 자동 재로그인을 하지 않고(봇 탐지 회피) "재로그인 필요" 안내만 표시.
  const [sessionExpired, setSessionExpired] = useState(false);
  const cookieKey = useRef(cookieKeyForUrl(MANABA_LOGIN_URL)).current;

  // 화면에 들어올 때마다: 캐시/DB 로드 + 쿠키 확인 + 숨은 WebView 새로고침
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // 캐시 내용을 항상 반영 (로그아웃으로 캐시가 비면 화면도 비워짐)
        const cached = await getCachedNotices();
        if (active) setNotices(cached?.notices || []);

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
      if (data.length === 0) return; // 빈 결과는 기존 캐시 유지
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

  // 두 데이터 소스 병합 — URL 기준 dedup, DB(읽음 추적 가능) 우선
  const dbUrls = new Set(dbNotices.map((n) => n.notice_url).filter(Boolean));
  const merged = [
    ...dbNotices.map(normalizeDbNotice),
    ...notices
      .filter((n) => !n.href || !dbUrls.has(n.href))
      .map((n) => ({ ...n, _source: 'web' })),
  ];
  const unreadCount = dbNotices.length;

  const goToDetail = async (item) => {
    // 푸시 출처면 읽음 처리 (UI에서도 즉시 제거)
    if (item._source === 'push' && item._id) {
      setDbNotices((prev) => prev.filter((n) => n.id !== item._id));
      markNoticeAsRead(item._id); // 실패해도 UX는 그대로 진행
    }
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeDetail',
      params: { url: item.href, title: item.title },
    });
  };

  const goToList = () =>
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeList',
      params: { notices },
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
            onPress={() => navigation.navigate('Manaba')}
          >
            <Text style={styles.expiredBannerText}>
              ⚠️ ログインの有効期限が切れました。{expiredMessage()}
            </Text>
          </TouchableOpacity>
        )}

        {top.map((item, i) => (
          <TouchableOpacity
            key={item._id || item.href || i}
            style={styles.noticeCard}
            activeOpacity={0.7}
            onPress={() => goToDetail(item)}
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
        ))}

        {hiddenWebView}
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
          onPress={() => navigation.navigate('Manaba')}
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
          onPress={() => navigation.navigate('Manaba')}
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
