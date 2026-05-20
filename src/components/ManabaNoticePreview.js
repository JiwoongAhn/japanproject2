// 홈 화면 manaba 공지 미리보기 카드
//
// 화면에 안 보이는 WebView(height 0)로 manaba 홈을 열어 저장된 쿠키로 로그인
// 상태를 복원하고, PARSE_NOTICES_JS로 공지를 파싱해 카드로 보여준다.
// 사용자는 manaba에 직접 들어가지 않아도 새 공지를 확인할 수 있고,
// 탭하면 해당 공지의 manaba 원본으로 바로 이동한다.
//
// 핵심 원칙: 비밀번호 서버 저장 ❌ — 기존 manaba 쿠키 영속 방식만 재사용.
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, shadow } from '../constants/spacing';
import { MANABA_LOGIN_URL, MANABA_HOME_URL, PARSE_NOTICES_JS } from '../constants/manaba';
import { getSavedCookieHeader, cookieKeyForUrl } from '../utils/schoolCookies';
import { getCachedNotices, setCachedNotices } from '../utils/manabaCache';

const PREVIEW_COUNT = 3; // 카드에 보여줄 공지 개수

export default function ManabaNoticePreview({ navigation }) {
  const [notices, setNotices] = useState([]);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [cookieChecked, setCookieChecked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // 화면 재진입 시 WebView 재마운트용
  const cookieKey = useRef(cookieKeyForUrl(MANABA_LOGIN_URL)).current;

  // 화면에 들어올 때마다: 캐시 즉시 로드 + 쿠키 확인 + 숨은 WebView 새로고침
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // 캐시 내용을 항상 반영 (로그아웃으로 캐시가 비면 화면도 비워짐)
        const cached = await getCachedNotices();
        if (active) setNotices(cached?.notices || []);

        const header = await getSavedCookieHeader(cookieKey);
        if (!active) return;
        setCookieHeader(header || null);
        setCookieChecked(true);
        if (header) setReloadKey((k) => k + 1); // 쿠키 있을 때만 백그라운드 파싱
      })();
      return () => {
        active = false;
      };
    }, [cookieKey])
  );

  // 숨은 WebView 파싱 결과 수신
  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'notices') return;
      // 쿠키가 만료돼 로그인 페이지로 튕긴 경우 → 갱신하지 않고 기존 캐시 유지
      if (msg.currentUrl && msg.currentUrl.includes('/ct/login')) return;
      const data = Array.isArray(msg.data) ? msg.data : [];
      if (data.length === 0) return; // 빈 결과는 기존 캐시 유지
      setNotices(data);
      setCachedNotices(data);
    } catch {
      // 파싱 실패는 조용히 무시 (홈 화면은 그대로 유지)
    }
  };

  const goToDetail = (item) =>
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeDetail',
      params: { url: item.href, title: item.title },
    });

  const goToList = () =>
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeList',
      params: { notices },
    });

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

  // 1) 공지가 있으면 카드 표시
  if (notices.length > 0) {
    const top = notices.slice(0, PREVIEW_COUNT);
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>📢 manabaのお知らせ</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{notices.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={goToList}>
            <Text style={styles.seeAll}>すべて見る</Text>
          </TouchableOpacity>
        </View>

        {top.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.noticeCard}
            activeOpacity={0.7}
            onPress={() => goToDetail(item)}
          >
            {!!item.board && <Text style={styles.boardTag} numberOfLines={1}>{item.board}</Text>}
            <Text style={styles.noticeTitle} numberOfLines={2}>{item.title}</Text>
            {!!item.date && <Text style={styles.noticeDate}>{item.date}</Text>}
          </TouchableOpacity>
        ))}

        {hiddenWebView}
      </View>
    );
  }

  // 2) 공지도 캐시도 없는데 쿠키도 없음 → 로그인 유도 카드
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
});
