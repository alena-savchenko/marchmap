import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RouteScreen } from './src/screens/RouteScreen';
import { useTheme } from './src/theme/theme';
export default function App() {
  const { scheme, preference, colors } = useTheme();
  useEffect(() => { Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference); }, [preference]);
  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {}); }, [colors.background]);
  return <SafeAreaProvider><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /><RouteScreen /></SafeAreaProvider>;
}
