import { NetworkManager, OfflineManager, type OfflinePack, type OfflinePackStatus } from '@maplibre/maplibre-react-native';
import type { Route } from '../models/route';
import { emptyPreparation, MAP_STYLE, routeRegion, type MapMode, type Preparation } from './mapPolicy';

/** Serial transitions prevent old downloads/callbacks from changing the new mode. */
export class OfflineController {
  private revision = 0;
  private queue = Promise.resolve();
  private pack: OfflinePack | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private report: (status: Preparation) => void) {}

  configure(mode: MapMode, route: Route | null, prepare = true) {
    const revision = ++this.revision;
    clearTimeout(this.timer);
    this.queue = this.queue.then(async () => {
      if (this.pack) { OfflineManager.removeListener(this.pack.id); await this.pack.pause(); this.pack = null; }
      if (revision !== this.revision) return;
      NetworkManager.setConnected(mode !== 'offline');
      let state = { ...emptyPreparation };
      let failed = false;
      const active = () => revision === this.revision && !failed;
      const fail = (message: string) => {
        if (!active()) return;
        failed = true;
        clearTimeout(this.timer);
        NetworkManager.setConnected(mode !== 'offline');
        if (this.pack) { OfflineManager.removeListener(this.pack.id); void this.pack.pause().catch(() => {}); }
        state = { ...state, state: state.bytes > 0 ? 'partial' : 'error', message };
        this.report(state);
      };
      const watchdog = () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => fail('Нет прогресса загрузки. Проверьте интернет и нажмите «Повторить».'), 90000);
      };
      const progress = (_pack: OfflinePack, status: OfflinePackStatus) => {
        if (!active()) return;
        const ready = status.state === 'complete';
        if (status.completedResourceSize > state.bytes) watchdog();
        state = { state: ready ? 'ready' : 'loading', percentage: Math.min(100, Math.max(0, status.percentage || 0)), bytes: status.completedResourceSize };
        if (ready) { clearTimeout(this.timer); NetworkManager.setConnected(mode !== 'offline'); }
        this.report(state);
      };
      try {
        this.report(state);
        if (!route) return;
        const bounds = routeRegion(route);
        const key = JSON.stringify({ bounds, style: MAP_STYLE, maxZoom: 14 });
        const packs = await OfflineManager.getPacks();
        if (!active()) return;
        this.pack = packs.find((pack) => pack.metadata.marchMapRegion === key) ?? null;
        const status = await this.pack?.status();
        if (!active()) return;
        if (status?.state === 'complete') { progress(this.pack!, status); return; }
        if (mode === 'online' || !prepare) {
          if (status) this.report({ state: status.completedResourceSize ? 'partial' : 'empty', bytes: status.completedResourceSize, percentage: status.percentage });
          return;
        }
        this.report({ ...state, state: 'loading' });
        NetworkManager.setConnected(true); // Explicit preparation is the only offline-mode network window.
        watchdog();
        if (this.pack) {
          await OfflineManager.addListener(this.pack.id, progress, (_p, error) => fail(error.message));
          if (active()) await this.pack.resume();
        } else {
          this.pack = await OfflineManager.createPack({ mapStyle: MAP_STYLE, bounds, minZoom: 0, maxZoom: 14, metadata: { marchMapRegion: key, name: route.name } }, progress, (_p, error) => fail(error.message));
        }
        if (!active() && this.pack) { OfflineManager.removeListener(this.pack.id); await this.pack.pause(); }
        if (active() && this.pack) progress(this.pack, await this.pack.status());
      } catch (error) { fail(error instanceof Error ? error.message : 'Не удалось подготовить карту.'); }
    }).catch((error: unknown) => {
      if (revision === this.revision) { NetworkManager.setConnected(mode !== 'offline'); this.report({ ...emptyPreparation, state: 'error', message: String(error) }); }
    });
    return this.queue;
  }
  clearCache(mode: MapMode) {
    ++this.revision;
    clearTimeout(this.timer);
    const operation = this.queue.then(async () => {
      NetworkManager.setConnected(false);
      const packs = await OfflineManager.getPacks();
      this.pack = null;
      for (const pack of packs) {
        OfflineManager.removeListener(pack.id);
        await pack.pause();
        await OfflineManager.deletePack(pack.id);
      }
      await OfflineManager.clearAmbientCache();
      this.report({ ...emptyPreparation });
    }).finally(() => NetworkManager.setConnected(mode !== 'offline'));
    this.queue = operation.catch(() => {});
    return operation;
  }
  dispose() { return this.configure('offline', null); }
}
