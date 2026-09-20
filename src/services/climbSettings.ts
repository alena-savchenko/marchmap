import { File, Paths } from 'expo-file-system';
import { CUSTOM_DISTANCE_RANGE_M, CUSTOM_GRADE_RANGE, DEFAULT_CLIMB_SETTINGS, type ClimbSettings } from '../config/climbs';
export function isValidClimbSettings(value: unknown): value is ClimbSettings {
  if (!value || typeof value !== 'object') return false;
  const s = value as ClimbSettings;
  return ['high', 'medium', 'low', 'custom'].includes(s.preset) && Number.isFinite(s.customGrade) && s.customGrade >= CUSTOM_GRADE_RANGE[0] && s.customGrade <= CUSTOM_GRADE_RANGE[1]
    && Number.isFinite(s.customDistanceM) && s.customDistanceM >= CUSTOM_DISTANCE_RANGE_M[0] && s.customDistanceM <= CUSTOM_DISTANCE_RANGE_M[1];
}
const file = () => new File(Paths.document, 'climbs.json');
export function loadClimbSettings(): ClimbSettings {
  try { const saved = file(); const value: unknown = saved.exists ? JSON.parse(saved.textSync()) : null; return isValidClimbSettings(value) ? value : { ...DEFAULT_CLIMB_SETTINGS }; }
  catch { return { ...DEFAULT_CLIMB_SETTINGS }; }
}
export function saveClimbSettings(settings: ClimbSettings) {
  if (!isValidClimbSettings(settings)) throw new Error('Проверьте параметры чувствительности подъёмов.');
  file().write(JSON.stringify(settings));
}
