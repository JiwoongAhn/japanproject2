import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import Card from './Card';

// 이용규약(利用規約) 본문 (전문).
// App Store Guideline 1.2 (UGC) 필수 조항: 불쾌 콘텐츠 무관용 / 24시간 내 조치 /
// 통보·블록·삭제 안내 / 문의처. 동의 화면(PrivacyConsentScreen)과
// 이용규약 화면(TermsOfServiceScreen)이 같은 법적 문구를 공유하도록 한 곳에 모아둔다.
export default function TermsOfServiceBody() {
  return (
    <>
      {/* 상단 안내 카드 */}
      <Card padding="lg" radius="lg" style={styles.intro}>
        <Text style={styles.introTitle}>ご利用にあたって</Text>
        <Text style={styles.updated}>最終更新日：2026年7月1日</Text>
      </Card>

      <Section title="はじめに">
        {`本利用規約（以下「本規約」）は、UniOne（ユニワン）（以下「本アプリ」）の利用条件を定めるものです。本アプリを利用することで、利用者は本規約に同意したものとみなされます。`}
      </Section>

      <Section title="第1条（禁止事項・不適切なコンテンツ）">
        {`本アプリは、掲示板・講義評価などで利用者が投稿できる機能を提供します。当運営は、以下のような不快・不適切なコンテンツおよび迷惑行為を一切許容しません（ゼロトレランス）。\n\n・他者への誹謗中傷、侮辱、差別、いやがらせ（ハラスメント）\n・暴力的・性的・違法な内容、わいせつな表現\n・個人情報の無断掲載、なりすまし\n・その他、他の利用者を不快にさせる行為`}
      </Section>

      <Section title="第2条（違反への対応）">
        {`当運営は、通報を受けた不適切なコンテンツについて、確認後24時間以内に削除し、悪質な利用者のアカウントを利用停止（追放）する措置をとります。`}
      </Section>

      <Section title="第3条（利用者が使える機能）">
        {`利用者は、不適切なコンテンツや迷惑な利用者に対して次の操作を行えます。\n\n・投稿・コメントの「通報」\n・迷惑な利用者の「ブロック」\n・自分が投稿した内容の即時「削除」`}
      </Section>

      <Section title="第4条（免責）">
        {`本アプリは学生同士の情報交換を目的としており、投稿内容の正確性・適法性について保証しません。投稿は各利用者の責任において行われるものとします。`}
      </Section>

      <Section title="第5条（お問い合わせ）">
        {`不適切なコンテンツの報告やご質問は、以下までご連絡ください。\n\nメール: support@unipas.app`}
      </Section>

      <Text style={styles.footer}>
        本アプリは18歳以上の大学生を対象としています。
      </Text>
    </>
  );
}

function Section({ title, children }) {
  return (
    <Card padding="lg" radius="lg" style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: spacing.md,
  },
  introTitle: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  updated: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    ...typography.body2,
    color: colors.gray700,
  },
  footer: {
    ...typography.caption,
    color: colors.textDisabled,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
});
