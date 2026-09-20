export type ThemePreference = 'system' | 'light' | 'dark';
export function parseTheme(value: unknown): ThemePreference { return value === 'light' || value === 'dark' ? value : 'system'; }
export function resolveTheme(preference: ThemePreference, system: string | null | undefined) { return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference; }
export const light = {
  background: '#fbfcfa', surface: '#ffffff', soft: '#edf3ee', empty: '#f0f5ef',
  text: '#172f2a', muted: '#637770', accent: '#155847', border: '#aac5b8',
  line: '#dce6de', track: '#e1ebe5', selected: '#e9f3ed', selectionBorder: '#69a58b',
  radio: '#97a69f', green: '#157151', progress: '#399e76', grid: '#e2eae5',
  route: '#256d60', orange: '#c26a17', blue: '#2679e8', danger: '#a34832',
};
export type Colors = typeof light;
export const dark: Colors = {
  background: '#111c1a', surface: '#1c2c28', soft: '#263b34', empty: '#162620',
  text: '#e8f2ed', muted: '#afc3b9', accent: '#85d8b3', border: '#56786a',
  line: '#354e43', track: '#304a40', selected: '#244a3a', selectionBorder: '#70bc97',
  radio: '#91a89d', green: '#85d8b3', progress: '#6ac49a', grid: '#354e43',
  route: '#76d7b6', orange: '#ffb76b', blue: '#80b4ff', danger: '#ffac95',
};
