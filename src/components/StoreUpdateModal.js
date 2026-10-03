import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { getAppVersion } from '../utils/appVersion';

/**
 * 네이티브 업데이트(새 빌드)가 필요할 때 뜨는 모달.
 *
 * iOS 는 앱이 자기 자신의 새 바이너리를 설치할 수 없으므로(OS 제약),
 * App Store 제품 페이지를 바로 열어주는 것이 할 수 있는 최선이다.
 * 유저가 스토어에서 앱을 검색할 필요가 없어지는 것이 이 모달의 가치다.
 *
 * 강제 업데이트는 하지 않는다 — 「あとで」로 닫고 계속 쓸 수 있다.
 */
export default function StoreUpdateModal({ visible, storeVersion, releaseNotes, onOpenStore, onDismiss }) {
  const { version: installed } = getAppVersion();

  // 릴리스 노트는 길 수 있으니 앞쪽 몇 줄만 보여준다
  const notes = (releaseNotes || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>新しいバージョンがあります</Text>

          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>現在のバージョン</Text>
            <Text style={styles.versionValue}>{installed || '—'}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>最新バージョン</Text>
            <Text style={[styles.versionValue, styles.versionNew]}>{storeVersion || '—'}</Text>
          </View>

          {notes.length > 0 && (
            <ScrollView style={styles.notes} contentContainerStyle={styles.notesInner}>
              {notes.map((line, i) => (
                <Text key={i} style={styles.noteLine}>{line}</Text>
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost]}
              onPress={onDismiss}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="あとで"
            >
              <Text style={styles.buttonGhostText}>あとで</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={onOpenStore}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="App Store へ"
            >
              <Text style={styles.buttonPrimaryText}>App Store へ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  title: {
    ...typography.title3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  versionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  versionValue: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  versionNew: {
    color: colors.primary,
  },
  notes: {
    maxHeight: 140,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesInner: {
    gap: 4,
  },
  noteLine: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  buttonGhost: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonGhostText: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryText: {
    ...typography.body1,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
