// マイページ 「アップデート情報」 — 지난 업데이트 내용 목록
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReleaseItems } from '../components/ReleaseNoteSheet';
import { RELEASE_NOTES } from '../constants/releaseNotes';
import { colors } from '../constants/colors';
import { spacing, radius, shadow } from '../constants/spacing';
import { typography } from '../constants/typography';

export default function ReleaseNotesScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="戻る"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>アップデート情報</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {RELEASE_NOTES.map((n) => (
          <View key={n.id} style={styles.card}>
            <Text style={styles.label}>{n.label}</Text>
            <ReleaseItems items={n.items} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, lineHeight: 32, color: colors.textPrimary },
  headerTitle: { ...typography.subtitle, color: colors.textPrimary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.md,
    paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xs, ...shadow.card,
  },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.md },
});
