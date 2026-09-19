import messages from './messages.json';
export type Language = 'ru' | 'en' | 'de';
export type LanguagePreference = Language | 'system';
export const catalog: Record<string, string[]> = messages;
export function resolveLanguage(preference: unknown, deviceLocale: string): Language {
  const value = preference === 'ru' || preference === 'en' || preference === 'de' ? preference : deviceLocale.toLowerCase().split(/[-_]/)[0];
  return value === 'ru' || value === 'de' ? value : 'en';
}
export function parsePreference(value: unknown): LanguagePreference { return value === 'ru' || value === 'en' || value === 'de' ? value : 'system'; }
export function translate(language: Language, key: string, values: Record<string, string | number> = {}): string {
  const template = language === 'ru' ? key : catalog[key]?.[language === 'en' ? 0 : 1] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}
export function translateError(language: Language, error: unknown, fallback = 'Произошла ошибка. Проверьте разрешения, подключение и свободное место.') {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const key = Object.keys(catalog).find((key) => key.length > 12 && message.includes(key));
  return translate(language, key ?? fallback);
}
export function numberText(language: Language, value: number, digits = 1) { return new Intl.NumberFormat(language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
