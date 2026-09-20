import { expect, it } from 'vitest';
import { incomingFilename } from './incomingFile';
import { RouteLibrary } from './routeLibrary';

it.each(['application/gpx+xml', 'application/gpx', 'application/xml', 'application/octet-stream', null])('imports cloud files without a display extension (%s)', mime => {
  const files = new Map<string, string>();
  const library = new RouteLibrary({ read: n => files.get(n) ?? null, write: (n, v) => { files.set(n, v); }, remove: n => { files.delete(n); } });
  const xml = '<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2.1"/></trkseg></trk></gpx>';
  const filename = incomingFilename({ name: 'cloud-id-123', mime });
  expect(library.import(xml, filename, xml.length).points).toHaveLength(2);
  expect(new RouteLibrary({ read: n => files.get(n) ?? null, write: (n, v) => { files.set(n, v); }, remove: n => { files.delete(n); } }).snapshot().routes).toHaveLength(1);
});

it('accepts missing metadata but validates content before changing the library', () => {
  const files = new Map<string, string>();
  const library = new RouteLibrary({ read: n => files.get(n) ?? null, write: (n, v) => { files.set(n, v); }, remove: n => { files.delete(n); } });
  const filename = incomingFilename({ name: null, mime: null });
  const valid = '<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2.1"/></trkseg></trk></gpx>';
  library.import(valid, 'Existing.gpx', valid.length);
  const before = library.snapshot();
  const savedFiles = [...files.entries()];
  for (const content of ['<html>Sign in</html>', 'garbage', '<gpx><trk><trkseg><trkpt lat="bad" lon="2"/></trkseg></trk></gpx>']) {
    expect(() => library.import(content, filename, content.length)).toThrow();
    expect(library.snapshot()).toBe(before);
    expect([...files.entries()]).toEqual(savedFiles);
  }
});

it.each(['photo.jpg', 'file.txt', 'route.gpx.zip', 'route.gpx.exe'])('rejects explicit other formats: %s', name => {
  expect(() => incomingFilename({ name, mime: 'application/gpx+xml' })).toThrow();
});
it('preserves actual names and refuses HTML/image metadata for opaque files', () => {
  expect(incomingFilename({ name: 'Hike.GPX', mime: null })).toBe('Hike.GPX');
  expect(incomingFilename({ name: null, mime: ' Application/GPX+XML; charset=utf-8' })).toBe('Маршрут.gpx');
  for (const mime of ['text/html', 'image/jpeg']) expect(() => incomingFilename({ name: null, mime })).toThrow();
});
