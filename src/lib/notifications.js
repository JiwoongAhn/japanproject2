import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// 포그라운드 알림 표시 방식 설정 (배지+사운드+배너)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 푸시 알림 권한 요청 + Expo Push Token 발급 + Supabase push_tokens 저장
 * 앱 시작 시 (로그인 후) 1회 호출
 * @returns {string|null} expo_token or null (실기기 아니거나 권한 거부 시)
 */
export async function registerPushToken() {
  if (!Device.isDevice) {
    console.log('[Push] 실기기가 아닙니다 — 푸시 토큰 발급 생략');
    return null;
  }

  // Android 13+ 은 채널 필요
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3182f6',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] 알림 권한 거부됨');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoToken = tokenData.data;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: user.id,
        expo_token: expoToken,
        platform: Platform.OS,
      },
      { onConflict: 'expo_token' }
    );

  if (error) {
    console.error('[Push] 토큰 저장 실패:', error.message);
    return null;
  }

  console.log('[Push] 토큰 저장 완료:', expoToken);
  return expoToken;
}

/**
 * 푸시 알림 리스너 등록
 * @param {function} onNotificationTap - 사용자가 푸시를 탭했을 때 콜백 ({ noticeId, noticeUrl, subject, bodyHtml })
 * @returns {function} cleanup 함수 — useEffect return 용
 */
export function setupNotificationListeners(onNotificationTap) {
  // 포그라운드: 알림 수신 시 (탭 없이 도착만 해도)
  const receivedSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('[Push] 포그라운드 수신:', notification.request.content.title);
  });

  // 백그라운드/종료 상태: 사용자가 알림 탭 시
  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data && onNotificationTap) {
      onNotificationTap({
        noticeId: data.noticeId,
        noticeUrl: data.noticeUrl,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
      });
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * 앱 시작 시 이미 탭된 알림이 있으면 처리 (종료 상태에서 탭한 경우)
 * @param {function} onNotificationTap
 */
export async function handleInitialNotification(onNotificationTap) {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) {
    const data = response.notification.request.content.data;
    if (data && onNotificationTap) {
      onNotificationTap({
        noticeId: data.noticeId,
        noticeUrl: data.noticeUrl,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
      });
    }
  }
}
