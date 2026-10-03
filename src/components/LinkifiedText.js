import React, { useMemo, useCallback } from 'react';
import { Text, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../constants/colors';
import { splitTextWithLinks } from '../utils/linkify';

/**
 * 본문 안의 URL 을 탭 가능하게 만들어 그리는 Text.
 *
 * 앱을 벗어나지 않도록 인앱 브라우저로 연다(시라바스·학교 홈페이지와 같은 방식).
 * 유저가 올린 주소라 신뢰할 수 없으므로, 열기 전에 어디로 가는지 확인을 받는다.
 *
 * @param children  본문 문자열
 * @param style     기존 Text 스타일 그대로 전달
 */
export default function LinkifiedText({ children, style, ...rest }) {
  const parts = useMemo(() => splitTextWithLinks(children), [children]);

  const openLink = useCallback((url) => {
    Alert.alert(
      'リンクを開きますか？',
      url,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '開く',
          onPress: () => {
            WebBrowser.openBrowserAsync(url, {
              toolbarColor: colors.primary,
              controlsColor: '#FFFFFF',
            }).catch(() => {
              Alert.alert('開けませんでした', 'このリンクは開けませんでした。');
            });
          },
        },
      ],
      { cancelable: true }
    );
  }, []);

  // 링크가 없으면 조각내지 않고 평소처럼 그린다 (대부분의 글이 여기에 해당)
  if (!parts.some((p) => p.type === 'link')) {
    return <Text style={style} {...rest}>{children}</Text>;
  }

  return (
    <Text style={style} {...rest}>
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <Text
            key={i}
            style={styles.link}
            onPress={() => openLink(part.url)}
            suppressHighlighting={false}
            accessibilityRole="link"
            accessibilityLabel={`リンク ${part.value}`}
          >
            {part.value}
          </Text>
        ) : (
          part.value
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
