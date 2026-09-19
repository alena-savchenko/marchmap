import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { buildRoute, type InputPoint } from './route';

type Element = Record<string, unknown>;
const list = (value: unknown): Element[] => value == null ? [] : (Array.isArray(value) ? value : [value]).filter((item): item is Element => typeof item === 'object' && item !== null);
function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseGPX(xml: string, fallbackName = 'Маршрут') {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('GPX с DTD или XML entities не поддерживается.');
  if (XMLValidator.validate(xml) !== true) throw new Error('Некорректный XML в GPX.');
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, parseTagValue: false, processEntities: true }).parse(xml);
  const root = parsed.gpx;
  if (!root || typeof root !== 'object') throw new Error('Файл не является GPX.');
  const tracks = list(root.trk);
  const segments: InputPoint[][] = [];
  for (const track of tracks) {
    for (const segment of list(track.trkseg)) {
      segments.push(list(segment.trkpt).map((p) => {
        const lat = numeric(p.lat);
        const lon = numeric(p.lon);
        if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('GPX содержит некорректные координаты.');
        return { lat, lon, elevation: numeric(p.ele) };
      }));
    }
  }
  const name = tracks.find((track) => typeof track.name === 'string' && track.name.trim())?.name;
  return buildRoute(segments, typeof name === 'string' ? name.trim() : fallbackName);
}
