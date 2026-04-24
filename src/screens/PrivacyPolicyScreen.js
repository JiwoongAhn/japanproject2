import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { colors } from '../constants/colors';

// 개인정보처리방침 화면 (Apple 심사 필수)
export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>プライバシーポリシー</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>最終更新日：2026年4月24日</Text>

        <Section title="1. はじめに">
          {`Unipas（ユニパス）（以下「本アプリ」）は、日本の大学生のための学校生活支援アプリです。本プライバシーポリシーは、本アプリがお客様の個人情報をどのように収集・利用・保護するかについて説明します。\n\n本アプリをご利用いただくことで、本ポリシーに同意したものとみなします。`}
        </Section>

        <Section title="2. 収集する情報">
          {`本アプリは以下の情報を収集します。\n\n【アカウント情報】\n・学校メールアドレス（@ac.jp）\n・ニックネーム\n・所属大学名\n\n【利用データ】\n・時間割情報（科目名・曜日・時限）\n・課題情報（タイトル・期限）\n・掲示板への投稿・コメント\n・強義評価（評価・コメント）\n\n【技術情報】\n・アプリの利用ログ（エラー情報等）`}
        </Section>

        <Section title="3. 情報の利用目的">
          {`収集した情報は以下の目的で利用します。\n\n・アカウントの認証および管理\n・サービス機能の提供（時間割・課題・掲示板等）\n・在学生であることの確認\n・サービスの改善および不正利用の防止\n・重要なお知らせの送信`}
        </Section>

        <Section title="4. 情報の共有">
          {`本アプリは、以下の場合を除き、お客様の個人情報を第三者に提供しません。\n\n・お客様の同意がある場合\n・法令に基づく開示が必要な場合\n・サービス提供に必要な業務委託先への提供（Supabase等）`}
        </Section>

        <Section title="5. 利用するサービス">
          {`本アプリは以下の外部サービスを利用しています。\n\n・Supabase（データベース・認証）\n  プライバシーポリシー: supabase.com/privacy\n\n・Expo（アプリ基盤）\n  プライバシーポリシー: expo.dev/privacy`}
        </Section>

        <Section title="6. データの保管期間">
          {`・アカウント情報：退会まで保持\n・掲示板の投稿：退会時に削除\n・時間割・課題：退会時に削除\n\n退会手続きを行うと、すべての個人データは速やかに削除されます。`}
        </Section>

        <Section title="7. アカウントの削除">
          {`お客様はいつでもアカウントを削除できます。\n\nアプリ内の「マイページ」→「退会する」から手続きが可能です。退会するとすべてのデータ（プロフィール・時間割・課題・投稿・コメント）が完全に削除され、復元できません。`}
        </Section>

        <Section title="8. セキュリティ">
          {`本アプリは以下のセキュリティ対策を実施しています。\n\n・通信の暗号化（HTTPS/TLS）\n・認証トークンのAES-256暗号化保存\n・Row Level Security（RLS）によるデータアクセス制御\n・学校メールアドレスによる在学生認証`}
        </Section>

        <Section title="9. お子様のプライバシー">
          {`本アプリは大学生（18歳以上）を対象としています。18歳未満の方の利用は想定しておりません。`}
        </Section>

        <Section title="10. プライバシーポリシーの変更">
          {`本ポリシーは必要に応じて更新されることがあります。重要な変更がある場合は、アプリ内でお知らせします。`}
        </Section>

        <Section title="11. お問い合わせ">
          {`個人情報の取り扱いに関するご質問・ご要望は、以下のメールアドレスまでお問い合わせください。\n\nメール: support@unipas.app`}
        </Section>

        <Text style={styles.footer}>
          本アプリは日本の個人情報保護法（個人情報の保護に関する法律）に準拠して個人情報を取り扱います。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton:  { width: 60 },
  backText:    { fontSize: 15, color: colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  content:     { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
  updated:     { fontSize: 12, color: colors.textSecondary, marginBottom: 24 },
  section:     { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14, color: colors.textSecondary, lineHeight: 22,
  },
  footer: {
    fontSize: 12, color: colors.textDisabled,
    lineHeight: 18, marginTop: 8, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
