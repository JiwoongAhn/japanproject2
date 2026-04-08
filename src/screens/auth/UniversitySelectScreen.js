import React from 'react';
import {
  View, Text, TouchableOpacity,
  FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import { universities } from '../../constants/universities';
import { colors } from '../../constants/colors';

// 대학 선택 화면 — 앱 첫 실행 시 한 번만 표시
// 선택한 대학 정보는 로그인 화면으로 전달됨
export default function UniversitySelectScreen({ navigation }) {
  const handleSelect = (university) => {
    navigation.navigate('Login', { university });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View>
        <Text style={styles.universityName}>{item.name}</Text>
        <Text style={styles.location}>{item.location}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>大学を選んでください</Text>
        <Text style={styles.subtitle}>あなたの大学を選択してください</Text>
      </View>
      <FlatList
        data={universities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
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
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  list: {
    paddingHorizontal: 24,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  universityName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  location: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  arrow: {
    fontSize: 24,
    color: colors.textDisabled,
  },
});
