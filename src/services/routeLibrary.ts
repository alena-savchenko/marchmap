import { parseGPX, validateGPXFile } from './gpx';
import type { Route } from '../models/route';
export type SavedRoute = { id: string; name: string; filename: string; distance: number; pointCount: number; importedAt: number };
export type Library = { revision: number; activeId: string | null; mapsCleared: boolean; routes: SavedRoute[] };
export type Storage = { read: (name: string) => string | null; write: (name: string, value: string) => void; remove: (name: string) => void };
const empty = (): Library => ({ revision: 0, activeId: null, mapsCleared: false, routes: [] });
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value);
export function decodeLibrary(text: string | null): Library | null {
  try {
    const value = JSON.parse(text ?? 'null');
    if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.mapsCleared !== 'boolean' || !Array.isArray(value.routes)) return null;
    if (!value.routes.every((r: SavedRoute) => r && safeId(r.id) && typeof r.name === 'string' && typeof r.filename === 'string' && Number.isFinite(r.distance) && r.distance >= 0 && Number.isSafeInteger(r.pointCount) && r.pointCount >= 2 && Number.isFinite(r.importedAt))) return null;
    if (new Set(value.routes.map((r: SavedRoute) => r.id)).size !== value.routes.length) return null;
    if (value.activeId !== null && !value.routes.some((r: SavedRoute) => r.id === value.activeId)) return null;
    return value;
  } catch { return null; }
}
/** Two manifest slots preserve the last committed library if a write is interrupted. */
export class RouteLibrary {
  private state: Library;
  constructor(private storage: Storage) {
    const candidates = ['library-0.json', 'library-1.json'].map((file) => decodeLibrary(storage.read(file))).filter((x): x is Library => x !== null);
    this.state = candidates.sort((a, b) => b.revision - a.revision)[0] ?? empty();
  }
  snapshot() { return this.state; }
  private commit(next: Library) {
    const state = { ...next, revision: this.state.revision + 1 };
    this.storage.write(`library-${state.revision % 2}.json`, JSON.stringify(state));
    this.state = state;
    return state;
  }
  open(id: string): Route {
    const item = this.state.routes.find((r) => r.id === id);
    if (!item) throw new Error('Маршрут не найден.');
    const xml = this.storage.read(`${id}.gpx`);
    if (xml === null) throw new Error('Сохранённый GPX недоступен. Импортируйте его снова.');
    const route = parseGPX(xml, item.name);
    this.commit({ ...this.state, activeId: id });
    return route;
  }
  import(xml: string, filename: string, bytes: number): Route {
    validateGPXFile(filename, bytes);
    const route = parseGPX(xml, filename.replace(/\.gpx$/i, ''));
    const existing = this.state.routes.find((r) => this.storage.read(`${r.id}.gpx`) === xml);
    if (existing) { this.commit({ ...this.state, activeId: existing.id, mapsCleared: false }); return route; }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    this.storage.write(`${id}.gpx`, xml);
    const item: SavedRoute = { id, name: route.name, filename, distance: route.totalDistance, pointCount: route.points.length, importedAt: Date.now() };
    try { this.commit({ ...this.state, activeId: id, mapsCleared: false, routes: [item, ...this.state.routes] }); }
    catch (error) { this.storage.remove(`${id}.gpx`); throw error; }
    return route;
  }
  delete(id: string) {
    if (!this.state.routes.some((r) => r.id === id)) return this.state;
    const routes = this.state.routes.filter((r) => r.id !== id);
    const next = this.commit({ ...this.state, routes, activeId: this.state.activeId === id ? routes[0]?.id ?? null : this.state.activeId });
    this.storage.remove(`${id}.gpx`);
    return next;
  }
  setMapsCleared(mapsCleared: boolean) { return this.commit({ ...this.state, mapsCleared }); }
}
