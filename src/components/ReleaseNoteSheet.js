// 「新しくなりました」 — 업데이트 뒤 처음 켤 때 한 번 (내용 = constants/releaseNotes.js)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import Button from './Button';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';

export function ReleaseItems({ items }) {
  return items.map((it) => (
    <View key={it.title} style={styles.item}>
      <View style={styles.icon}>
        <Ionicons name={it.icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.itemTitle}>{it.title}</Text>
        <Text style={styles.itemText}>{it.text}</Text>
      </View>
    </View>
  ));
}

export default function ReleaseNoteSheet({ note, onClose }) {
  return (
    <BottomSheet visible={!!note} onClose={onClose}>
      {note ? (
        <>
          <Text style={styles.title}>新しくなりました</Text>
          <Text style={styles.label}>{note.label}のアップデート</Text>
          <ReleaseItems items={note.items} />
          <Button title="はじめる" onPress={onClose} />
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title3, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  item: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  icon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  texts: { flex: 1 },
  itemTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  itemText: { ...typography.caption, color: colors.textSecondary },
});
