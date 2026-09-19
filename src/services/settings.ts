import { File, Paths } from 'expo-file-system';
import { parseMapMode, type MapMode } from './mapPolicy';

const settingsFile = () => new File(Paths.document, 'map-mode.txt');
export function loadMapMode(): MapMode {
  try { const file = settingsFile(); return parseMapMode(file.exists ? file.textSync().trim() : null); }
  catch { return parseMapMode(null); }
}
export function saveMapMode(mode: MapMode) { settingsFile().write(mode); }
