import React from 'react';
import {
  View, Text, TouchableOpacity,
  FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import { universities } from '../../constants/universities';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';

// 대학 선택 화면 — 앱 첫 실행 시 한 번만 표시
// 선택한 대학 정보는 로그인 화면으로 전달됨
export default function UniversitySelectScreen({ navigation }) {
  const handleSelect = (university) => {
    navigation.navigate('SchoolPortalAuth', { university });
  };

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
      {/* 헤더 — 1 thing/1 page: 대학 선택이 화면의 유일한 핵심 액션 */}
      <View style={styles.header}>
        <Text style={styles.title}>大学を選んでください</Text>
        <Text style={styles.subtitle}>あなたの大学を選択してください</Text>
      </View>
      <FlatList
        data={universities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
    paddingBottom: spacing.xxl,
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
});
