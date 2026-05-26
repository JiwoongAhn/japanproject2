import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../lib/AuthProvider';
import { colors } from '../../constants/colors';

// 메일 본문 HTML을 모바일에 맞게 래핑
function buildHtml(bodyHtml) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, sans-serif;
          font-size: 15px;
          line-height: 1.6;
          color: #191F28;
          padding: 16px;
          margin: 0;
          word-break: break-word;
        }
        a { color: #3182F6; }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>${bodyHtml ?? '<p>본문을 불러올 수 없습니다.</p>'}</body>
    </html>
  `;
}

export default function NoticePreviewModal() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clearPendingNotice } = useAuth();

  const { subject, bodyHtml, noticeUrl } = route.params ?? {};

  const handleClose = () => {
    clearPendingNotice();
    navigation.goBack();
  };

  const handleOpenManaba = () => {
    clearPendingNotice();
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeDetail',
      params: { url: noticeUrl },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeText}>닫기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          공지 미리보기
        </Text>
        <View style={styles.closeButton} />
      </View>

      {/* 공지 제목 */}
      <View style={styles.subjectBox}>
        <Text style={styles.subjectLabel}>제목</Text>
        <Text style={styles.subjectText}>{subject ?? '(제목 없음)'}</Text>
      </View>

      {/* 메일 본문 */}
      <WebView
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html: buildHtml(bodyHtml) }}
        scrollEnabled
        showsVerticalScrollIndicator={false}
      />

      {/* 하단 버튼 */}
      {noticeUrl ? (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.manabaButton} onPress={handleOpenManaba}>
            <Text style={styles.manabaButtonText}>manabaで詳しく見る</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 48,
  },
  closeText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
  subjectBox: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.gray50,
  },
  subjectLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  manabaButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  manabaButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
