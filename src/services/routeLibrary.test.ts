import { beforeEach, describe, expect, it } from 'vitest';
import { RouteLibrary, decodeLibrary, type Storage } from './routeLibrary';
const xml = (name: string) => `<gpx><trk><name>${name}</name><trkseg><trkpt lat="50" lon="10"/><trkpt lat="50.01" lon="10.01"/></trkseg></trk></gpx>`;
let files: Map<string, string>, storage: Storage, library: RouteLibrary;
beforeEach(() => {
  files = new Map();
  storage = { read: (name) => files.get(name) ?? null, write: (name, value) => { files.set(name, value); }, remove: (name) => { files.delete(name); } };
  library = new RouteLibrary(storage);
});
describe('persistent route library', () => {
  it('stores routes and restores the selected route after restart', () => {
    library.import(xml('First'), 'first.gpx', 200); const first = library.snapshot().activeId!;
    library.import(xml('Second'), 'second.gpx', 200); library.open(first);
    const restarted = new RouteLibrary(storage);
    expect(restarted.snapshot().routes).toHaveLength(2);
    expect(restarted.open(restarted.snapshot().activeId!).name).toBe('First');
  });
  it('deduplicates the same file but keeps different routes with the same name', () => {
    library.import(xml('Same'), 'one.gpx', 200); library.import(xml('Same'), 'two.gpx', 200);
    expect(library.snapshot().routes).toHaveLength(1);
    library.import(xml('Same').replace('50.01', '50.02'), 'one.gpx', 200);
    expect(library.snapshot().routes).toHaveLength(2);
  });
  it('deletes active, inactive and last route without restoring deleted files', () => {
    library.import(xml('First'), 'first.gpx', 200); const first = library.snapshot().activeId!;
    library.import(xml('Second'), 'second.gpx', 200); const second = library.snapshot().activeId!;
    library.delete(second); expect(library.snapshot().activeId).toBe(first); expect(files.has(`${second}.gpx`)).toBe(false);
    library.import(xml('Third'), 'third.gpx', 200); const third = library.snapshot().activeId!;
    library.delete(first); expect(library.snapshot().activeId).toBe(third);
    library.delete(third); expect(new RouteLibrary(storage).snapshot().routes).toEqual([]); expect(library.snapshot().activeId).toBeNull();
  });
  it('rejects invalid imports while preserving existing state and files', () => {
    library.import(xml('First'), 'first.gpx', 200); const before = JSON.stringify(library.snapshot()); const count = files.size;
    expect(() => library.import('<html/>', 'bad.gpx', 10)).toThrow(); expect(() => library.import(xml('bad'), 'bad.txt', 200)).toThrow();
    expect(JSON.stringify(library.snapshot())).toBe(before); expect(files.size).toBe(count);
  });
  it('keeps the previous manifest if a newer write is truncated', () => {
    library.import(xml('First'), 'first.gpx', 200); const first = library.snapshot().activeId;
    library.import(xml('Second'), 'second.gpx', 200); files.set('library-0.json', '{"revision":');
    expect(new RouteLibrary(storage).snapshot().activeId).toBe(first);
  });
  it('does not commit imports when storage is full', () => {
    library.import(xml('First'), 'first.gpx', 200); const before = library.snapshot();
    const write = storage.write;
    storage.write = (name, value) => { if (name.startsWith('library-')) throw Error('disk full'); write(name, value); };
    expect(() => library.import(xml('Second'), 'second.gpx', 200)).toThrow('disk full');
    expect(library.snapshot()).toBe(before); expect([...files.keys()].filter((name) => name.endsWith('.gpx'))).toHaveLength(1);
  });
  it('persists the explicit map-cache deletion independently of GPX', () => {
    library.import(xml('First'), 'first.gpx', 200); library.setMapsCleared(true);
    const restarted = new RouteLibrary(storage); expect(restarted.snapshot().mapsCleared).toBe(true);
    expect(restarted.open(restarted.snapshot().activeId!).name).toBe('First'); expect(restarted.snapshot().mapsCleared).toBe(true);
    restarted.import(xml('Second'), 'second.gpx', 200); expect(restarted.snapshot().mapsCleared).toBe(false);
  });
  it('rejects corrupt manifests and path traversal', () => {
    expect(decodeLibrary('{')).toBeNull();
    library.import(xml('First'), 'first.gpx', 200);
    const state = structuredClone(library.snapshot()); state.routes[0].id = '../../escape';
    expect(decodeLibrary(JSON.stringify(state))).toBeNull();
  });
  it('reports a missing saved GPX without silently switching routes', () => {
    library.import(xml('First'), 'first.gpx', 200); const id = library.snapshot().activeId!; files.delete(`${id}.gpx`);
    expect(() => library.open(id)).toThrow('недоступен');
    expect(library.snapshot().activeId).toBe(id);
  });
});
