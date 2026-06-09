import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// 메일 연결 온보딩을 이미 보여줬는지 저장하는 키 (기기당 1회)
const SHOWN_KEY = 'mail_connect_onboarding_shown_v1';

// 현재 사용자가 MS 메일을 이미 연결했는지 확인
// mail_subscriptions에 행이 있으면 연결된 상태
export async function isMailConnected() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('mail_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * manaba 진입 공통 함수 — "첫 진입 시 1회" 메일 연결 온보딩 게이트 포함
 *
 * 규칙:
 *  - 특정 공지로 바로 가는 딥링크(params 있음)는 게이트를 건너뜀 (흐름 방해 방지)
 *  - 안내를 아직 안 봤고(첫 진입) + 메일 미연결이면 → 온보딩 화면 먼저
 *  - 그 외에는 바로 manaba로 이동
 *
 * @param {object} navigation  react-navigation navigation 객체
 * @param {object} [params]    navigate('Manaba', params)에 넘길 파라미터 (딥링크)
 */
export async function openManaba(navigation, params) {
  // 딥링크(특정 공지 이동)는 항상 바로 진입
  if (params) {
    navigation.navigate('Manaba', params);
    return;
  }

  try {
    const shown = await AsyncStorage.getItem(SHOWN_KEY);
    if (!shown) {
      // 한 번 보여줬다고 먼저 기록 (도중에 앱을 닫아도 반복 노출 방지)
      await AsyncStorage.setItem(SHOWN_KEY, '1');
      const connected = await isMailConnected();
      if (!connected) {
        // 온보딩 화면이 연결/스킵 후 알아서 manaba로 이동시킴
        navigation.navigate('MailConnectOnboarding');
        return;
      }
    }
  } catch {
    // 저장소 오류 등은 무시하고 그냥 manaba로 진입
  }

  navigation.navigate('Manaba');
}
