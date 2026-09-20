export type IncomingFile = { uri: string; name: string | null; mime: string | null };

/** Only external providers may omit an extension; picker validation stays strict.
 * MIME is a hint, never proof: RouteLibrary.import still validates every XML/GPX point.
 */
export function incomingFilename(file: Pick<IncomingFile, 'name' | 'mime'>): string {
  const name = file.name?.trim();
  if (name && /\.gpx$/i.test(name)) return name;
  const mime = file.mime?.split(';')[0].trim().toLowerCase();
  const gpxMime = mime === 'application/gpx+xml' || mime === 'application/gpx';
  const genericMime = !mime || ['application/xml', 'text/xml', 'application/octet-stream'].includes(mime);
  // Explicitly named files of another format must not be disguised as GPX.
  if ((gpxMime || genericMime) && (!name || !name.includes('.'))) return `${name || 'Маршрут'}.gpx`;
  throw new Error('Выберите файл с расширением .gpx.');
}
