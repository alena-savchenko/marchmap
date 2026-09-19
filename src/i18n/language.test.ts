import { beforeEach, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ value: null as string | null, fail: false }));
vi.mock('expo-file-system', () => ({ Paths: { document: 'documents' }, File: class {
  get exists() { return storage.value !== null; }
  textSync() { if (storage.fail) throw new Error('unreadable'); return storage.value; }
  write(value: string) { if (storage.fail) throw new Error('full disk'); storage.value = value; }
} }));
vi.mock('react', () => ({ useMemo: (fn: () => unknown) => fn(), useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }));
beforeEach(() => { vi.resetModules(); storage.value = null; storage.fail = false; });
it('persists and restores each language after module restart', async () => {
  for (const value of ['en', 'de', 'ru', 'system'] as const) {
    const first = await import('./language'); first.setLanguagePreference(value);
    vi.resetModules(); const restarted = await import('./language');
    expect(restarted.useLanguage().preference).toBe(value);
  }
});
it('defaults to system for missing, corrupt or unreadable storage', async () => {
  for (const value of [null, 'bad', 'de']) {
    storage.value = value; storage.fail = value === 'de'; vi.resetModules();
    expect((await import('./language')).useLanguage().preference).toBe('system');
  }
});
it('keeps the current language when saving fails', async () => {
  const language = await import('./language'); language.setLanguagePreference('de'); storage.fail = true;
  expect(() => language.setLanguagePreference('en')).toThrow();
  expect(language.useLanguage().preference).toBe('de');
});
