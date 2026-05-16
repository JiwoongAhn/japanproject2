import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import Card from '../../components/Card';

// 학기 선택 칩 옵션
const TERMS = [
  { key: 'spring', label: '春期' },
  { key: 'fall', label: '秋期' },
  { key: 'full', label: '通年' },
];

// Phase 2에서 실제 파서 연결 — 지금은 Mock 데이터로만 동작
const MOCK_PARSE_RESULT = {
  parsed: [
    { name: 'ビジネスコミュニケーション', day: 0, period: 1, term: 'spring', professor: '榊原 一也', credit: 2, campus: '町田', confidence: 'high' },
    { name: 'スポーツ実習Vテニス', day: 0, period: 2, term: 'spring', professor: '山田 美絵子', credit: 1, campus: '町田', confidence: 'high' },
    { name: '応用英語1', day: 0, period: 3, term: 'spring', professor: 'ヴィンセント ロバート', credit: 2, campus: '町田', confidence: 'high' },
    { name: '現代の国際経済', day: 1, period: 3, term: 'spring', professor: '金 明花', credit: 2, campus: '町田', confidence: 'high' },
    { name: '21世紀アジア学演習1', day: 1, period: 4, term: 'spring', professor: '土佐 昌樹', credit: 1, campus: '町田', confidence: 'high' },
    { name: '異文化理解', day: 2, period: 5, term: 'spring', professor: '濱田 英作', credit: 2, campus: '町田', confidence: 'high' },
    { name: 'Webデザインの基礎', day: 1, period: 4, term: 'spring', professor: '羽根 秀也', credit: 2, campus: '町田', confidence: 'high' },
    { name: 'キャリアデザイン3', day: 3, period: 4, term: 'spring', professor: '堤 由紀子', credit: 2, campus: '町田', confidence: 'high' },
    { name: 'プログラミング', day: null, period: null, term: 'spring', professor: null, credit: null, campus: null, confidence: 'low' },
  ],
  unparsed: [],
  detectedPeriodRanges: {
    1: { start: '09:00', end: '10:30' },
    2: { start: '10:45', end: '12:15' },
    3: { start: '12:55', end: '14:25' },
    4: { start: '14:40', end: '16:10' },
    5: { start: '16:25', end: '17:55' },
  },
};

export default function BulkAddInputScreen({ navigation, route }) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('spring');
  // 누적 모드를 위한 기존 결과 — 상위 화면에서 넘겨준 경우만 표시
  const existingResult = route?.params?.existingResult ?? null;

  const handleParse = () => {
    // 실제 파서는 Phase 2에서 연결. 지금은 Mock 데이터 그대로 전달
    navigation.navigate('BulkAddPreview', {
      parseResult: MOCK_PARSE_RESULT,
      defaultTerm: term,
    });
  };

  const handleAppendParse = () => {
    // 기존 결과에 추가하는 시나리오 — Phase 2에서 병합 로직 연결
    navigation.navigate('BulkAddPreview', {
      parseResult: MOCK_PARSE_RESULT,
      defaultTerm: term,
      appendTo: existingResult,
    });
  };

  const canParse = text.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.headerCancel}>キャンセル</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>時間割を貼り付け</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── 안내 카드 (sky 파스텔) ── */}
          <Card pastel="sky" padding="lg" style={{ marginBottom: spacing.lg }}>
            <Text style={styles.guideTitle}>
              🍁 学校のシステムから時間割をコピーして貼り付けてください
            </Text>
            <Text style={styles.guideSub}>
              kaedei → 推奨 / 一度に貼れない場合は分けて貼り付けOK
            </Text>
          </Card>

          {/* ── 학기 선택 ── */}
          <Text style={styles.sectionLabel}>学期</Text>
          <View style={styles.chipRow}>
            {TERMS.map((t) => {
              const active = term === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTerm(t.key)}
                  activeOpacity={0.8}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 텍스트 입력 ── */}
          <Text style={styles.sectionLabel}>貼り付けエリア</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="ここに貼り付け..."
            placeholderTextColor={colors.textDisabled}
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />

          {/* ── 누적 모드 보조 버튼 ── */}
          {existingResult ? (
            <TouchableOpacity
              onPress={handleAppendParse}
              activeOpacity={0.8}
              style={styles.appendButton}
              disabled={!canParse}
            >
              <Text style={styles.appendButtonText}>📋 既存の結果に追加</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {/* ── 하단 fixed 영역 ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={handleParse}
            activeOpacity={0.85}
            disabled={!canParse}
            style={[styles.primaryButton, !canParse && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>解析する</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerCancel: {
    ...typography.body2,
    color: colors.textSecondary,
    minWidth: 64,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  headerRight: {
    minWidth: 64,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // 안내 카드
  guideTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  guideSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // 섹션 라벨
  sectionLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },

  // 학기 칩
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },

  // 텍스트 입력
  textArea: {
    minHeight: 240,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body2,
    color: colors.textPrimary,
  },

  // 누적 모드 버튼
  appendButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  appendButtonText: {
    ...typography.bodyStrong,
    color: colors.gray700,
  },

  // 하단 바
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  primaryButtonText: {
    ...typography.subtitle,
    color: colors.white,
  },
});
