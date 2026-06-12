import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { supabase } from '../../lib/supabase';

// 차단한 사용자 목록 + 해제. 게시판이 익명이라 사용자 식별 정보는 표시하지 않고
// 차단 일시와 해제 버튼만 제공한다. (App Store UGC 1.2 "차단 관리")
export default function BlockedUsersScreen({ navigation }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_blocks')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });
    setBlocks(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchBlocks(); }, [fetchBlocks]));

  const handleUnblock = (item) => {
    Alert.alert('ブロック解除', 'このユーザーのブロックを解除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '解除する',
        onPress: async () => {
          const { error } = await supabase.from('user_blocks').delete().eq('id', item.id);
          if (error) Alert.alert('お知らせ', '解除できませんでした');
          else setBlocks((prev) => prev.filter((b) => b.id !== item.id));
        },
      },
    ]);
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={18} color={colors.gray500} />
        </View>
        <View>
          <Text style={styles.name}>ブロック中のユーザー {index + 1}</Text>
          <Text style={styles.date}>{formatBlockedDate(item.created_at)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(item)} activeOpacity={0.8}>
        <Text style={styles.unblockText}>解除</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.gray700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ブロックしたユーザー</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : blocks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.gray300} />
          <Text style={styles.emptyText}>ブロックしたユーザーはいません</Text>
        </View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

function formatBlockedDate(ts) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}年${mm}月${dd}日にブロック`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  headerTitle: { ...typography.bodyStrong, color: colors.gray900 },
  list: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.body2, color: colors.gray900, fontWeight: '600' },
  date: { ...typography.caption, color: colors.gray500, marginTop: 2 },
  unblockBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  unblockText: { ...typography.caption, color: colors.gray700, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { ...typography.body2, color: colors.gray500 },
});
