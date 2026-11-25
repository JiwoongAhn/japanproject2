import React from 'react';
import HomeBanner from './HomeBanner';
import { colors } from '../constants/colors';

/**
 * OTA 업데이트가 있을 때 홈 상단에 뜨는 배너.
 * 「今すぐ更新」을 누르면 앱 안에서 새 번들을 받아 재시작한다 — 스토어에 가지 않는다.
 */
export default function UpdateBanner({ onUpdate, onDismiss, applying, error }) {
  return (
    <HomeBanner
      icon="sparkles-outline"
      iconColor={colors.primary}
      title="アップデートがあります"
      text={error
        ? '更新に失敗しました。通信環境を確認してもう一度お試しください。'
        : '新しい機能と修正が利用できます。'}
      action={error ? '再試行' : '今すぐ更新'}
      onAction={onUpdate}
      onDismiss={onDismiss}
      loading={applying}
    />
  );
}
