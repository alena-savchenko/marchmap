import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ value: null as string | null, fail: false, system: 'light' }));
vi.mock('expo-file-system', () => ({ Paths: { document: 'documents' }, File: class {
  get exists() { return state.value !== null; }
  textSync() { if (state.fail) throw new Error('unreadable'); return state.value; }
  write(value: string) { if (state.fail) throw new Error('disk full'); state.value = value; }
} }));
vi.mock('react', () => ({ useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }));
vi.mock('react-native', () => ({ useColorScheme: () => state.system }));
beforeEach(() => { vi.resetModules(); state.value = null; state.fail = false; state.system = 'light'; });
it('restores all choices after restart and updates with system theme', async () => {
  for (const value of ['light', 'dark', 'system'] as const) {
    (await import('./theme')).setThemePreference(value);
    vi.resetModules(); const theme = await import('./theme');
    expect(theme.useTheme().preference).toBe(value);
  }
  const theme = await import('./theme');
  state.system = 'dark'; expect(theme.useTheme().scheme).toBe('dark');
  state.system = 'light'; expect(theme.useTheme().scheme).toBe('light');
});
it('falls back safely for corrupt or unreadable storage', async () => {
  for (const value of ['broken', 'dark']) {
    state.value = value; state.fail = value === 'dark'; vi.resetModules();
    expect((await import('./theme')).useTheme().preference).toBe('system');
  }
});
it('retains the saved preference if writing fails', async () => {
  const theme = await import('./theme'); theme.setThemePreference('dark'); state.fail = true;
  expect(() => theme.setThemePreference('light')).toThrow();
  expect(theme.useTheme().preference).toBe('dark');
});
