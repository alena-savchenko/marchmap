import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { buildRoute, type InputPoint } from './route';

type Element = Record<string, unknown>;
const list = (value: unknown): Element[] => {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Некорректная структура GPX.');
    return item as Element;
  });
};
function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(value).trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseGPX(xml: string, fallbackName = 'Маршрут') {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('GPX с DTD или XML entities не поддерживается.');
  if (XMLValidator.validate(xml) !== true) throw new Error('Некорректный XML в GPX.');
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, parseTagValue: false, processEntities: true }).parse(xml);
  const root = parsed.gpx;
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Файл не является GPX.');
  const tracks = list(root.trk);
  const segments: InputPoint[][] = [];
  for (const track of tracks) {
    for (const segment of list(track.trkseg)) {
      segments.push(list(segment.trkpt).map((p) => {
        const lat = numeric(p.lat);
        const lon = numeric(p.lon);
        if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('GPX содержит некорректные координаты.');
        const elevation = numeric(p.ele);
        if (p.ele != null && elevation === null) throw new Error('GPX содержит некорректную высоту.');
        return { lat, lon, elevation };
      }));
    }
  }
  const name = tracks.find((track) => typeof track.name === 'string' && track.name.trim())?.name;
  return buildRoute(segments, typeof name === 'string' ? name.trim() : fallbackName);
}

export function validateGPXFile(name: string, size: number) {
  if (!/\.gpx$/i.test(name)) throw new Error('Выберите файл с расширением .gpx.');
  if (!Number.isFinite(size) || size <= 0) throw new Error('Файл пуст или недоступен.');
  if (size > 25 * 1024 * 1024) throw new Error('Выберите GPX размером до 25 МБ.');
}
