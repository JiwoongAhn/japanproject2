import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../lib/AuthProvider';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { markNoticeAsRead } from '../../utils/manabaNotices';
import { summarizeManabaMail } from '../../utils/manabaMailSummary';

// 메일 요약의 deadline("MM/DD HH:MM")을 AssignmentAdd가 받는 YYYY-MM-DD로 변환.
// 메일 본문에는 연도가 없으므로 현재 연도를 사용하되, 결과가 오늘보다 과거면 +1년
// (연말 → 연초 케이스 대비).
function deadlineToDueDate(deadlineShort) {
  if (!deadlineShort) return '';
  const m = deadlineShort.match(/^(\d{2})\/(\d{2})/);
  if (!m) return '';
  const today = new Date();
  let year = today.getFullYear();
  const mm = m[1];
  const dd = m[2];
  const todayStr = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const candidate = `${year}-${mm}-${dd}`;
  if (candidate < todayStr) {
    year += 1;
    return `${year}-${mm}-${dd}`;
  }
  return candidate;
}

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
    <body>${bodyHtml ?? '<p>本文を読み込めませんでした。</p>'}</body>
    </html>
  `;
}

export default function NoticePreviewModal() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clearPendingNotice } = useAuth();

  const { subject, bodyHtml, noticeUrl, noticeId } = route.params ?? {};

  // 본문 정규식 파싱으로 과목/요약/마감/첨부 추출.
  // 본문 WebView 위에 한 줄 요약 카드를 띄워 빠른 인지 도움.
  const summary = summarizeManabaMail({ subject, bodyHtml });

  // AI 요약(온디맨드): 사용자가 버튼을 누를 때만 Edge Function 호출 → 비용 통제.
  // PC용 긴 본문을 학생이 읽기 쉬운 일본어 요점으로 정리해 가독성 개선.
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const handleAiSummarize = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-notice', {
        body: { subject, bodyHtml },
      });
      // invoke는 함수가 4xx/5xx여도 error에 담긴다. 서버가 준 일본어 메시지를 우선 표시.
      const serverMsg = data?.error;
      if (error || serverMsg || !data?.summary) {
        setAiError(serverMsg ?? '要約できませんでした。しばらくして再度お試しください。');
        return;
      }
      setAiSummary(data.summary);
    } catch (e) {
      setAiError('要約できませんでした。しばらくして再度お試しください。');
    } finally {
      setAiLoading(false);
    }
  };

  // 미리보기 모달이 열린 시점 = 사용자가 푸시를 확인한 시점 → 읽음 처리.
  // 닫기/原本 이동 어느 경로로 빠져나가도 동일하게 적용한다.
  const markAsReadOnce = () => {
    if (noticeId) markNoticeAsRead(noticeId); // 결과는 await하지 않음 (UX 지연 방지)
  };

  const handleClose = () => {
    markAsReadOnce();
    clearPendingNotice();
    navigation.goBack();
  };

  const handleOpenManaba = () => {
    markAsReadOnce();
    clearPendingNotice();
    navigation.navigate('Manaba', {
      screen: 'ManabaNoticeDetail',
      params: { url: noticeUrl },
    });
  };

  // 課題(レポート) / 小テスト 메일이면 과제 추가 버튼 노출.
  // 마감일이 없어도 노출하고, dueDate는 빈 값으로 두어 사용자가 직접 입력하게 한다.
  const canAddAssignment =
    summary.type.key === 'report' || summary.type.key === 'quiz';

  const handleAddAssignment = () => {
    markAsReadOnce();
    clearPendingNotice();
    navigation.navigate('MainTab', {
      screen: 'Assignment',
      params: {
        screen: 'AssignmentAdd',
        params: {
          courseName: summary.courseName ?? '',
          title: summary.summary ?? '',
          dueDate: deadlineToDueDate(summary.deadline),
        },
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeText}>閉じる</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          お知らせプレビュー
        </Text>
        <View style={styles.closeButton} />
      </View>

      {/* 공지 제목 */}
      <View style={styles.subjectBox}>
        <Text style={styles.subjectLabel}>件名</Text>
        <Text style={styles.subjectText}>{subject ?? '(件名なし)'}</Text>
      </View>

      {/* AI 요약 카드 — 버튼을 눌러 생성된 경우에만 표시 (읽기 쉬운 요점) */}
      {(aiSummary || aiError) && (
        <View style={aiError ? styles.aiErrorCard : styles.aiCard}>
          {aiSummary ? (
            <>
              <Text style={styles.aiCardLabel}>🤖 AI要約</Text>
              <Text style={styles.aiCardText}>{aiSummary}</Text>
            </>
          ) : (
            <Text style={styles.aiErrorText}>{aiError}</Text>
          )}
        </View>
      )}

      {/* 요약 카드 — 정형 메일이면 과목/요약/마감/첨부 한눈에 표시 */}
      {(summary.courseName || summary.summary) && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryType}>
              {summary.type.icon} {summary.type.label}
            </Text>
            {!!summary.courseName && (
              <Text style={styles.summaryCourse} numberOfLines={1}>
                📚 {summary.courseName}
              </Text>
            )}
          </View>
          {!!summary.summary && (
            <Text style={styles.summaryText} numberOfLines={3}>
              {summary.summary}
            </Text>
          )}
          {(summary.deadline || summary.hasAttach || summary.author) && (
            <View style={styles.summaryMetaRow}>
              {!!summary.deadline && (
                <Text style={styles.summaryDeadline}>⏰ 締切 {summary.deadline}</Text>
              )}
              {summary.hasAttach && <Text style={styles.summaryMeta}>📎 添付</Text>}
              {!!summary.author && (
                <Text style={styles.summaryMeta} numberOfLines={1}>
                  ✍️ {summary.author}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* 메일 본문 */}
      <WebView
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html: buildHtml(bodyHtml) }}
        scrollEnabled
        showsVerticalScrollIndicator={false}
      />

      {/* 하단 버튼 — AI요약 / 과제추가 / manaba원본 세로 정렬 */}
      {(canAddAssignment || noticeUrl || (bodyHtml && !aiSummary)) ? (
        <View style={styles.footer}>
          {/* AI 요약: 본문이 있고 아직 요약 전일 때만 노출 (재과금 방지) */}
          {bodyHtml && !aiSummary && (
            <TouchableOpacity
              style={styles.aiButton}
              onPress={handleAiSummarize}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.aiButtonText}>🤖 AIで要約</Text>
              )}
            </TouchableOpacity>
          )}
          {canAddAssignment && (
            <TouchableOpacity
              style={styles.addAssignmentButton}
              onPress={handleAddAssignment}
            >
              <Text style={styles.addAssignmentButtonText}>📝 課題として追加</Text>
            </TouchableOpacity>
          )}
          {noticeUrl ? (
            <TouchableOpacity style={styles.manabaButton} onPress={handleOpenManaba}>
              <Text style={styles.manabaButtonText}>manabaで詳しく見る</Text>
            </TouchableOpacity>
          ) : null}
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
  aiCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    backgroundColor: '#F5F3FF', // 보라 계열(AI 강조)
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    gap: 6,
  },
  aiCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  aiCardText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  aiErrorCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    backgroundColor: colors.gray50,
    borderRadius: 12,
  },
  aiErrorText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  aiButton: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
  },
  aiButtonText: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    backgroundColor: '#EFF6FF', // 파란 강조 배경
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    gap: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  summaryType: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  summaryCourse: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryDeadline: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B00',
  },
  summaryMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  addAssignmentButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  addAssignmentButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
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
