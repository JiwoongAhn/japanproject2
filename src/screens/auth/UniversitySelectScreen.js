import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { universities } from '../../constants/universities';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';

// 대학 선택 화면 — 앱 첫 실행 시 한 번만 표시
// 선택한 대학 정보는 로그인 화면으로 전달됨
export default function UniversitySelectScreen({ navigation }) {
  const [query, setQuery] = useState('');

  const handleSelect = (university) => {
    navigation.navigate('SchoolPortalAuth', { university });
  };

  // 이름·지역 둘 다로 필터 (예: "世田谷" 입력 시 해당 지역 대학들)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universities;
    return universities.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.location ?? '').toLowerCase().includes(q),
    );
  }, [query]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSelect(item)}
      activeOpacity={0.75}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.universityName}>{item.name}</Text>
        <Text style={styles.location}>{item.location}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 + 검색창 (목록 위에 고정) */}
      <View style={styles.header}>
        <Text style={styles.title}>大学を選んでください</Text>
        <Text style={styles.subtitle}>あなたの大学を選択してください</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="大学名・地域で検索"
            placeholderTextColor={colors.textDisabled}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textDisabled} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="school-outline" size={32} color={colors.textDisabled} />
            <Text style={styles.emptyText}>該当する大学が見つかりません</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  list: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadow.card,
  },
  universityName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  location: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  arrow: {
    fontSize: 22,
    color: colors.textDisabled,
    marginLeft: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.huge,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
});
