import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RouteScreen } from './src/screens/RouteScreen';
export default function App() {
  return <SafeAreaProvider><StatusBar style="dark" /><RouteScreen /></SafeAreaProvider>;
}
