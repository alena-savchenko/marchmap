import { Directory, File, Paths } from 'expo-file-system';
import { RouteLibrary } from './routeLibrary';
export function createRouteLibrary() {
  const folder = new Directory(Paths.document, 'routes');
  folder.create({ intermediates: true, idempotent: true });
  return new RouteLibrary({
    read: (name) => { const file = new File(folder, name); return file.exists ? file.textSync() : null; },
    write: (name, value) => new File(folder, name).write(value),
    remove: (name) => { const file = new File(folder, name); if (file.exists) file.delete(); },
  });
}
