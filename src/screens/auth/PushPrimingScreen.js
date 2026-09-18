import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import Button from '../../components/Button';
import { registerPushToken } from '../../lib/notifications';

// 프리퍼미션 표시 여부 저장 키 (AppNavigator 게이트에서 사용) — 기기 단위 1회
export const PUSH_PRIMING_KEY = 'push_priming_done_v1';

// 통지로 받을 수 있는 것들 (가치 제안)
const BENEFITS = [
  {
    icon: 'notifications',
    title: 'manabaの新しいお知らせ',
    body: 'manabaを連携すると、休講・課題・重要連絡がスマホの通知で届きます。メールを開かなくても大丈夫。',
  },
  {
    icon: 'time',
    title: '課題の締切リマインド',
    body: '提出期限が近づいた課題をお知らせ。うっかり忘れを防ぎます。',
  },
  {
    icon: 'chatbubble-ellipses',
    title: '掲示板の返信',
    body: 'あなたの投稿にコメントがついたら、すぐに気づけます。',
  },
];

// 이메일 인증 후·닉네임 설정 전에 1회 노출되는 통지 프리퍼미션 화면.
// OS 권한 팝업을 곧바로 띄우는 대신, 왜 통지가 필요한지 먼저 설명해 허용률을 높인다.
// props.onDone() 호출 시 다음 단계(닉네임)로 넘어간다.
export default function PushPrimingScreen({ onDone }) {
  const [working, setWorking] = useState(false);

  // "通知をオンにする" → 실제 OS 권한 요청 → 결과와 무관하게 다음 단계로
  const handleEnable = async () => {
    if (working) return;
    setWorking(true);
    try {
      await registerPushToken(); // prompt 기본 true → OS 팝업 표시
    } catch (_) {
      // 권한 거부·오류여도 온보딩은 계속 진행 (나중에 마이페이지에서 설정 가능)
    } finally {
      onDone?.();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 본문은 세로 ScrollView — 작은 화면(SE 등)에서 카드 3장이 다 안 들어가도
          하단 고정 버튼과 겹치지 않고 스크롤된다. 큰 화면은 내용이 안에 들어와 스크롤 없음 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 히어로 아이콘 */}
        <View style={styles.hero}>
          <View style={styles.bellCircle}>
            <Ionicons name="notifications" size={40} color={colors.white} />
          </View>
        </View>

        <Text style={styles.title}>大切なお知らせを、{'\n'}見逃さないために</Text>
        <Text style={styles.subtitle}>
          通知をオンにすると、こんなことをお届けします。
        </Text>

        {/* 가치 제안 카드 */}
        <View style={styles.cards}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.card}>
              <View style={styles.cardIcon}>
                <Ionicons name={b.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{b.title}</Text>
                <Text style={styles.cardBody}>{b.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={styles.bottom}>
        <Button title="通知をオンにする" onPress={handleEnable} loading={working} />
        <TouchableOpacity
          onPress={() => !working && onDone?.()}
          style={styles.laterBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.laterText}>あとで設定する</Text>
        </TouchableOpacity>
        <Text style={styles.footnote}>
          通知は、マイページからいつでもオン・オフできます。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1 },
  // ScrollView 는 padding 을 style 이 아니라 contentContainerStyle 로 받아야 한다(RN invariant)
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  bellCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title1,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body1,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cards: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardText: { flex: 1 },
  cardTitle: {
    ...typography.bodyStrong,
    color: colors.gray900,
    marginBottom: 3,
  },
  cardBody: {
    ...typography.body2,
    color: colors.gray600,
    lineHeight: 20,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  laterBtn: { alignItems: 'center', paddingVertical: spacing.md },
  laterText: { ...typography.bodyStrong, color: colors.gray600 },
  footnote: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
