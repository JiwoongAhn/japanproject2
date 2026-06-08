import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { colors } from '../../constants/colors';
import { getDismissedKeys, addDismissedKey, noticeKey } from '../../utils/manabaCache';

export default function ManabaNoticeListScreen({ route, navigation }) {
  // 넘겨받은 공지를 로컬 state로 보관 → 既読 시 즉시 목록에서 제거
  const [list] = useState(() => route.params?.notices ?? []);
  const [dismissed, setDismissed] = useState([]);

  // 화면 진입 시 이미 既読 처리된 공지 식별자를 불러와 가린다
  useEffect(() => {
    let active = true;
    (async () => {
      const keys = await getDismissedKeys();
      if (active) setDismissed(keys);
    })();
    return () => { active = false; };
  }, []);

  // 既読(삭제) — 숨김 목록에 저장하고 화면에서 즉시 제거
  const handleDismiss = (item) => {
    const key = noticeKey(item);
    setDismissed((prev) => (prev.includes(key) ? prev : [key, ...prev]));
    addDismissedKey(key);
  };

  // 아직 既読하지 않은 공지만 표시
  const visibleNotices = list.filter((n) => !dismissed.includes(noticeKey(n)));

  const renderItem = ({ item }) => (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.swipeAction}
          activeOpacity={0.8}
          onPress={() => handleDismiss(item)}
        >
          <Text style={styles.swipeActionText}>既読</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          handleDismiss(item); // 탭 = 확인 → 목록에서 제거
          navigation.navigate('ManabaNoticeDetail', {
            url: item.href,
            title: item.title,
          });
        }}
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
    </Swipeable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>お知らせ</Text>
        <View style={{ width: 40 }} />
      </View>

      {visibleNotices.length === 0 ? (
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
          data={visibleNotices}
          keyExtractor={(item, index) => noticeKey(item) || String(index)}
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
  // 스와이프 시 오른쪽 빨간 '既読' 버튼 (카드와 같은 세로 여백 맞춤)
  swipeAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginLeft: 8,
    marginVertical: 4,
    borderRadius: 12,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
