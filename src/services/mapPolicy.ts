import type { Route } from '../models/route';

export type MapMode = 'offline' | 'hybrid' | 'online';
export const DEFAULT_MAP_MODE: MapMode = 'hybrid';
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const mapModes: { value: MapMode; title: string; description: string }[] = [
  { value: 'offline', title: 'Только офлайн', description: 'Скачать область маршрута. После подготовки карта работает без сетевых запросов.' },
  { value: 'hybrid', title: 'Офлайн + онлайн-подгрузка', description: 'Маршрут доступен без интернета. Вне области карта подгружается при наличии сети.' },
  { value: 'online', title: 'Только онлайн', description: 'Загружать карту по мере просмотра. Без предварительного скачивания.' },
];
export function parseMapMode(value: unknown): MapMode {
  return value === 'offline' || value === 'online' || value === 'hybrid' ? value : DEFAULT_MAP_MODE;
}
export function routeRegion(route: Route): [number, number, number, number] {
  let west = 180, east = -180, south = 90, north = -90;
  for (const p of route.points) { west = Math.min(west, p.lon); east = Math.max(east, p.lon); south = Math.min(south, p.lat); north = Math.max(north, p.lat); }
  if (south < -85 || north > 85 || east - west > 180) throw new Error('Офлайн-подготовка полярных областей и перехода через 180° пока не поддерживается.');
  return [Math.max(-180, west - 0.01), Math.max(-85, south - 0.01), Math.min(180, east + 0.01), Math.min(85, north + 0.01)];
}
export type Preparation = { state: 'empty' | 'loading' | 'ready' | 'partial' | 'error'; percentage: number; bytes: number; message?: string };
export const emptyPreparation: Preparation = { state: 'empty', percentage: 0, bytes: 0 };
export const preparationLabels = { empty: 'Не загружена', loading: 'Загрузка', ready: 'Готова', partial: 'Частично загружена', error: 'Ошибка загрузки' };
