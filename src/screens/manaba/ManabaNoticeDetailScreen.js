import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { UNIPAS_USER_AGENT } from '../../constants/manaba';
import { colors } from '../../constants/colors';

// manaba 공지 원문도 PC용 레이아웃이므로 핀치줌 제약 제거
const ENABLE_PINCH_ZOOM_JS = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    var content = meta.getAttribute('content') || '';
    content = content.replace(/user-scalable\s*=\s*no/gi, 'user-scalable=yes');
    content = content.replace(/maximum-scale\s*=\s*1(\.0)?/gi, 'maximum-scale=5.0');
    meta.setAttribute('content', content);
  }
})();
true;
`;

export default function ManabaNoticeDetailScreen({ route, navigation }) {
  const { url, title } = route.params ?? {};
  const [loading, setLoading] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'お知らせ'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      <WebView
        source={{ uri: url }}
        style={styles.webView}
        applicationNameForUserAgent={UNIPAS_USER_AGENT}
        injectedJavaScript={ENABLE_PINCH_ZOOM_JS}
        scalesPageToFit={true}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
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
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  loadingBar: {
    height: 3,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  webView: {
    flex: 1,
  },
});
