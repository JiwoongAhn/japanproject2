import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';
import Button from '../../components/Button';

// 환영 화면을 이미 봤는지 기록하는 기기 단위 플래그 (최초 1회만 노출)
export const WELCOME_SEEN_KEY = 'welcome_seen_v1';

// 앱 최초 실행 시 가장 먼저 보이는 부드러운 환영 화면.
// 딱딱한 개인정보 동의보다 앞에 두어 "이 앱이 뭔지"를 먼저 부드럽게 전달한다.
// [始める]를 누르면 onStart()가 호출되고, AppNavigator가 다음 단계(동의)로 넘어간다.
export default function WelcomeScreen({ onStart }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.hero}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brand}>UniOne</Text>
        <Text style={styles.tagline}>
          時間割・課題・お知らせを、{'\n'}ひとつに。
        </Text>
        <Text style={styles.sub}>
          大学生活に必要なことを、{'\n'}このアプリだけでまとめて。
        </Text>
      </View>

      <View style={styles.bottomArea}>
        <Button title="始める" onPress={onStart} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: spacing.xl,
  },
  brand: {
    ...typography.title1,
    fontSize: 34,
    letterSpacing: -1,
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  tagline: {
    ...typography.title2,
    color: colors.gray900,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: spacing.md,
  },
  sub: {
    ...typography.body1,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomArea: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
});
