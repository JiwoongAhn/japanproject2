// 一括 → 시간표 읽기 방법 선택 시트 (전용 파서가 없는 학교용 — 国士舘은 기존 kaede 방식 그대로)
// 사용자 결정(2026-10-19): 3가지 다 보여준다. 학교 사이트 주소가 없는 학교는 첫 항목만 숨김
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';

export default function AiImportSheet({ visible, siteLabel, onSite, onImages, onText, onClose }) {
  const options = [
    siteLabel && {
      key: 'site', icon: 'school-outline', main: true,
      title: '大学のサイトから読み取る', sub: `${siteLabel}を開きます`, onPress: onSite,
    },
    { key: 'images', icon: 'images-outline', title: 'スクショから読み取る', sub: '保存済みの画像を選ぶ（最大3枚）', onPress: onImages },
    { key: 'text', icon: 'clipboard-outline', title: 'テキストを貼り付ける', sub: 'コピーした時間割を貼り付け', onPress: onText },
  ].filter(Boolean);

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="閉じる">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>時間割をまとめて登録</Text>
          <Text style={styles.desc}>大学のサイトに表示された時間割を、AIが読み取って登録します。</Text>
          {options.map((o) => (
            <TouchableOpacity
              key={o.key}
              style={[styles.opt, o.main && styles.optMain]}
              onPress={o.onPress}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.icon}>
                <Ionicons name={o.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.optTitle}>{o.title}</Text>
                  {o.main ? <Text style={styles.tag}>おすすめ</Text> : null}
                </View>
                <Text style={styles.optSub}>{o.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { ...typography.title3, color: colors.textPrimary },
  desc: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  opt: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  optMain: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  optTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  tag: { ...typography.micro, color: colors.primary, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.xs, overflow: 'hidden' },
  optSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cancel: { alignItems: 'center', paddingTop: spacing.sm },
  cancelText: { ...typography.body2, color: colors.textSecondary },
});
