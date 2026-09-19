import * as Location from 'expo-location';
import type { GPSPosition } from '../models/route';

export async function getCurrentLocation(): Promise<GPSPosition> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Разрешите доступ к геопозиции в настройках приложения.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Включите геолокацию на устройстве.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('GPS не ответил за 30 секунд. Попробуйте ещё раз на открытом месте.')), 30_000);
      }),
    ]);
    return { lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp };
  } finally { if (timer) clearTimeout(timer); }
}
