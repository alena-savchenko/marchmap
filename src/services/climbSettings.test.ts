import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_CLIMB_SETTINGS } from '../config/climbs';
import { isValidClimbSettings, loadClimbSettings, saveClimbSettings } from './climbSettings';
const storage = vi.hoisted(() => ({ value: null as string | null, fail: false }));
vi.mock('expo-file-system', () => ({ Paths: { document: 'documents' }, File: class {
  get exists() { return storage.value !== null; }
  textSync() { if(storage.fail) throw new Error('unreadable'); return storage.value; }
  write(value: string) { if(storage.fail) throw new Error('full disk'); storage.value=value; }
} }));
beforeEach(()=>{storage.value=null;storage.fail=false;});
it('defaults to medium and restores all presets/custom settings', () => {
  expect(loadClimbSettings()).toEqual(DEFAULT_CLIMB_SETTINGS);
  for(const preset of ['high','medium','low','custom'] as const) {
    const value={preset,customGrade:7.5,customDistanceM:1250}; saveClimbSettings(value); expect(loadClimbSettings()).toEqual(value);
  }
});
it('recovers missing/corrupt/unreadable preferences', () => {
  for(const text of ['{', 'null', '{}', '{"preset":"high"}']) {storage.value=text;expect(loadClimbSettings()).toEqual(DEFAULT_CLIMB_SETTINGS);}
  storage.fail=true; expect(loadClimbSettings()).toEqual(DEFAULT_CLIMB_SETTINGS);
});
it('rejects invalid, negative, nonfinite and extreme manual values', () => {
  for(const customGrade of [0,-1,31,NaN,Infinity]) expect(isValidClimbSettings({...DEFAULT_CLIMB_SETTINGS,preset:'custom',customGrade})).toBe(false);
  for(const customDistanceM of [0,249,50001,NaN,Infinity]) expect(isValidClimbSettings({...DEFAULT_CLIMB_SETTINGS,customDistanceM})).toBe(false);
  expect(()=>saveClimbSettings({...DEFAULT_CLIMB_SETTINGS,customGrade:NaN})).toThrow(); expect(storage.value).toBeNull();
});
it('preserves existing preferences when saving fails', () => {
  saveClimbSettings(DEFAULT_CLIMB_SETTINGS); const previous=storage.value; storage.fail=true;
  expect(()=>saveClimbSettings({...DEFAULT_CLIMB_SETTINGS,preset:'high'})).toThrow(); expect(storage.value).toBe(previous);
});
