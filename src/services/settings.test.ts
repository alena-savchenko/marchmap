import { beforeEach, expect, it, vi } from 'vitest';
import { loadMapMode, saveMapMode } from './settings';
const storage = vi.hoisted(() => ({ value: null as string | null, fail: false }));
vi.mock('expo-file-system', () => ({ Paths: { document: 'documents' }, File: class {
  get exists() { return storage.value !== null; }
  textSync() { if (storage.fail) throw new Error('unreadable'); return storage.value; }
  write(value: string) { if (storage.fail) throw new Error('full disk'); storage.value = value; }
} }));
beforeEach(() => { storage.value = null; storage.fail = false; });
it('defaults to hybrid on first start', () => expect(loadMapMode()).toBe('hybrid'));
it('restores every saved choice on the next read', () => {
  for (const mode of ['offline', 'hybrid', 'online'] as const) { saveMapMode(mode); expect(loadMapMode()).toBe(mode); }
});
it('recovers corrupt and unreadable settings', () => {
  storage.value = 'invalid'; expect(loadMapMode()).toBe('hybrid'); storage.fail = true; expect(loadMapMode()).toBe('hybrid');
});
it('propagates write failures so UI cannot promise persistence', () => { storage.fail = true; expect(() => saveMapMode('offline')).toThrow(); });
