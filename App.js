import 'react-native-gesture-handler';   // React Navigation 필수 — 반드시 최상단에 위치해야 함
import 'react-native-get-random-values'; // 암호화 난수 생성 — 반드시 최상단에 위치해야 함
import 'react-native-url-polyfill/auto'; // React Native URL 호환
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/lib/AuthProvider';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    // AuthProvider가 앱 전체를 감싸므로, 모든 화면에서 useAuth()를 사용할 수 있음
    <AuthProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </AuthProvider>
  );
}
