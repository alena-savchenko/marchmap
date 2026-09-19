import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineController } from './offline';
import { buildRoute } from './route';
const mocks = vi.hoisted(() => ({ packs: [] as any[], connected: vi.fn(), progress: null as any, error: null as any, create: vi.fn(), remove: vi.fn(), listen: vi.fn() }));
vi.mock('@maplibre/maplibre-react-native', () => ({
  NetworkManager: { setConnected: mocks.connected },
  OfflineManager: { getPacks: async () => mocks.packs, createPack: mocks.create, removeListener: mocks.remove, addListener: mocks.listen },
}));
const route = buildRoute([[{ lat: 50, lon: 10, elevation: 100 }, { lat: 50.01, lon: 10.01, elevation: 200 }]]);
const status = (complete = false, bytes = 0) => ({ state: complete ? 'complete' : 'active', completedResourceSize: bytes, percentage: complete ? 100 : 20 });
function pack() { return { id: '1', metadata: {}, status: vi.fn(async () => status()), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}) }; }
beforeEach(() => {
  vi.clearAllMocks(); mocks.packs = [];
  mocks.create.mockImplementation(async (options, progress, error) => { const p = pack(); p.metadata = options.metadata; mocks.packs.push(p); mocks.progress = progress; mocks.error = error; return p; });
});
describe('offline controller', () => {
  it('never predownloads in online mode', async () => {
    const controller = new OfflineController(vi.fn()); await controller.configure('online', route);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.connected).toHaveBeenLastCalledWith(true); await controller.dispose();
  });
  it('downloads in offline mode then disables map network on completion', async () => {
    const report = vi.fn(); const controller = new OfflineController(report); await controller.configure('offline', route);
    expect(mocks.create).toHaveBeenCalledOnce(); expect(mocks.connected).toHaveBeenLastCalledWith(true);
    mocks.progress(mocks.packs[0], status(true, 1048576));
    expect(report).toHaveBeenLastCalledWith({ state: 'ready', bytes: 1048576, percentage: 100 });
    expect(mocks.connected).toHaveBeenLastCalledWith(false); await controller.dispose();
  });
  it('keeps network enabled after hybrid completion', async () => {
    const controller = new OfflineController(vi.fn()); await controller.configure('hybrid', route); mocks.progress(mocks.packs[0], status(true, 50));
    expect(mocks.connected).toHaveBeenLastCalledWith(true); await controller.dispose();
  });
  it('retains partial data and disables offline network after an error', async () => {
    const report = vi.fn(); const controller = new OfflineController(report); await controller.configure('offline', route);
    mocks.progress(mocks.packs[0], status(false, 50)); mocks.error(mocks.packs[0], { message: 'No internet' });
    expect(report.mock.lastCall?.[0].state).toBe('partial'); expect(mocks.connected).toHaveBeenLastCalledWith(false); await controller.dispose();
  });
  it('reuses a completed persisted region without a new download', async () => {
    const controller = new OfflineController(vi.fn()); await controller.configure('hybrid', route); mocks.packs[0].status.mockResolvedValue(status(true, 50));
    await controller.configure('offline', route); expect(mocks.create).toHaveBeenCalledOnce(); expect(mocks.connected).toHaveBeenLastCalledWith(false); await controller.dispose();
  });
  it('ignores stale callbacks after switching modes', async () => {
    const report = vi.fn(); const controller = new OfflineController(report); await controller.configure('offline', route); const old = mocks.progress;
    await controller.configure('online', route); const count = report.mock.calls.length; old(mocks.packs[0], status(true, 50));
    expect(report).toHaveBeenCalledTimes(count); expect(mocks.connected).toHaveBeenLastCalledWith(true); expect(mocks.packs[0].pause).toHaveBeenCalled(); await controller.dispose();
  });
  it('reports stalled preparation and ignores late success after failure', async () => {
    vi.useFakeTimers();
    try {
      const report = vi.fn(); const controller = new OfflineController(report);
      await controller.configure('offline', route);
      await vi.advanceTimersByTimeAsync(90001);
      expect(report.mock.lastCall?.[0].state).toBe('error');
      const count = report.mock.calls.length;
      mocks.progress(mocks.packs[0], status(true, 100));
      expect(report).toHaveBeenCalledTimes(count);
      expect(mocks.connected).toHaveBeenLastCalledWith(false);
      await controller.dispose();
    } finally { vi.useRealTimers(); }
  });
});
