import 'react-native-gesture-handler';   // React Navigation 필수 — 반드시 최상단에 위치해야 함
import 'react-native-get-random-values'; // 암호화 난수 생성 — 반드시 최상단에 위치해야 함
import 'react-native-url-polyfill/auto'; // React Native URL 호환
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/lib/AuthProvider';
import AppNavigator from './src/navigation/AppNavigator';
import WideScreenContainer from './src/components/WideScreenContainer';

export default function App() {
  return (
    // GestureHandlerRootView: 스와이프 등 제스처가 앱 전역에서 동작하도록 최상단을 감싼다
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* AuthProvider가 앱 전체를 감싸므로, 모든 화면에서 useAuth()를 사용할 수 있음 */}
      <AuthProvider>
        <StatusBar style="dark" />
        {/* 아이패드·가로 모드에서 콘텐츠가 화면 폭만큼 늘어나지 않도록 가운데로 모은다.
            폰 크기에서는 아무 영향이 없다. */}
        <WideScreenContainer>
          <AppNavigator />
        </WideScreenContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
