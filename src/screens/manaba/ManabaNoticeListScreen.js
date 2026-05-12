import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors } from '../../constants/colors';

export default function ManabaNoticeListScreen({ route, navigation }) {
  const { notices = [], pageTitle = 'manaba' } = route.params ?? {};

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('ManabaNoticeDetail', {
          url: item.href,
          title: item.title,
        })
      }
    >
      <View style={styles.cardContent}>
        {/* 코스명/게시판 태그 (있을 때만) */}
        {!!item.board && (
          <Text style={styles.boardTag}>{item.board}</Text>
        )}
        <Text style={styles.noticeTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {!!item.date && (
          <Text style={styles.noticeDate}>{item.date}</Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>お知らせ</Text>
        <View style={{ width: 40 }} />
      </View>

      {notices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>お知らせはありません</Text>
          <Text style={styles.emptySubText}>
            manabaのホームを直接確認してください
          </Text>
          <TouchableOpacity
            style={styles.manabaDirectButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.manabaDirectButtonText}>manabaで確認する</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: colors.primary,
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 84,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  boardTag: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 22,
  },
  noticeDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: colors.textDisabled,
    marginLeft: 8,
  },
  separator: {
    height: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  manabaDirectButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  manabaDirectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
