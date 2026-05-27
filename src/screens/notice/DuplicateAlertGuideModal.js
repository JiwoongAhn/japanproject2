import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

const STEPS_IOS = [
  'iPhoneの「設定」アプリを開く',
  '「通知」→「Outlook」を選択',
  '「通知を許可」をオフにする',
];

const STEPS_ANDROID = [
  'Androidの「設定」→「アプリ」を開く',
  '「Outlook」を選択',
  '「通知」→「すべての通知をオフ」にする',
];

export default function DuplicateAlertGuideModal({ visible, onClose }) {
  const steps = Platform.OS === 'ios' ? STEPS_IOS : STEPS_ANDROID;
  const platformLabel = Platform.OS === 'ios' ? 'iPhone' : 'Android';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>重複通知を防ぐ設定</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>完了</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Unipasと連携すると、manabaの新着通知はUnipasからプッシュ通知で届きます。
              {'\n\n'}
              Outlookアプリの通知をオフにすることで、同じ通知が2回届くのを防げます。
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            {platformLabel}でOutlookの通知をオフにする手順
          </Text>

          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              ※ manabaのメールはOutlookのメール受信トレイに引き続き保存されます。通知だけをオフにします。
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeBtn: {
    paddingHorizontal: 4,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  body: {
    padding: 20,
    gap: 20,
  },
  infoBox: {
    backgroundColor: colors.primaryLight || '#EBF4FF',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    paddingTop: 3,
  },
  noteBox: {
    backgroundColor: colors.backgroundSecondary || '#F8F9FA',
    borderRadius: 10,
    padding: 14,
  },
  noteText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
