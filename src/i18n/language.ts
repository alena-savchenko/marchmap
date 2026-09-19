import { useMemo, useSyncExternalStore } from 'react';
import { File, Paths } from 'expo-file-system';
import { numberText, parsePreference, resolveLanguage, translate, translateError, type LanguagePreference } from './core';
const file = () => new File(Paths.document, 'language.txt');
let preference: LanguagePreference = 'system';
try { const saved = file(); preference = parsePreference(saved.exists ? saved.textSync().trim() : null); } catch { /* Device language remains the safe default. */ }
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setLanguagePreference(next: LanguagePreference) {
  file().write(next);
  preference = next;
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  const selected = useSyncExternalStore(subscribe, () => preference);
  const language = resolveLanguage(selected, Intl.DateTimeFormat().resolvedOptions().locale);
  return useMemo(() => ({ language, preference: selected, setPreference: setLanguagePreference,
    t: (key: string, values?: Record<string, string | number>) => translate(language, key, values),
    errorText: (error: unknown, fallback?: string) => translateError(language, error, fallback),
    n: (value: number, digits = 1) => numberText(language, value, digits),
  }), [language, selected]);
}
