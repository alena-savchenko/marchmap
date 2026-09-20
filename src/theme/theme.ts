import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { dark, light, parseTheme, resolveTheme, type ThemePreference } from './core';
const file = () => new File(Paths.document, 'theme.txt');
let preference: ThemePreference = 'system';
try { const saved = file(); preference = parseTheme(saved.exists ? saved.textSync().trim() : null); } catch { /* Use the system theme if storage is unavailable. */ }
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setThemePreference(next: ThemePreference) {
  file().write(next);
  preference = next;
  listeners.forEach(listener => listener());
}
export function useTheme() {
  const selected = useSyncExternalStore(subscribe, () => preference);
  const system = useColorScheme();
  const scheme = resolveTheme(selected, system);
  return { preference: selected, scheme, colors: scheme === 'dark' ? dark : light, setPreference: setThemePreference };
}
