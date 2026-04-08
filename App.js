import 'react-native-gesture-handler';   // React Navigation 필수 — 반드시 최상단에 위치해야 함
import 'react-native-get-random-values'; // 암호화 난수 생성 — 반드시 최상단에 위치해야 함
import 'react-native-url-polyfill/auto'; // React Native URL 호환
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
