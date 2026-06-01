/**
 * Unit tests for the playback-speed store. In-memory filesystem (overriding the
 * global react-native-blob-util mock for this file) so we can verify save / get,
 * cross-session persistence, the default, and rejection of invalid rates.
 */
import {
  DEFAULT_PLAYBACK_RATE,
  PlaybackRateStore,
} from '../src/audio/playbackRate';

const mockFiles = new Map<string, string>();

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { DocumentDir: '/doc' },
      exists: jest.fn((p: string) => Promise.resolve(mockFiles.has(p))),
      readFile: jest.fn((p: string) =>
        mockFiles.has(p)
          ? Promise.resolve(mockFiles.get(p))
          : Promise.reject(new Error('ENOENT')),
      ),
      writeFile: jest.fn((p: string, data: string) => {
        mockFiles.set(p, data);
        return Promise.resolve();
      }),
    },
  },
}));

beforeEach(() => mockFiles.clear());

describe('PlaybackRateStore', () => {
  test('defaults to normal speed when nothing is stored', async () => {
    expect(await new PlaybackRateStore().get()).toBe(DEFAULT_PLAYBACK_RATE);
  });

  test('persists a rate and reads it back in a fresh session', async () => {
    await new PlaybackRateStore().save(1.5);
    // New instance = cold start; must read from disk, not memory.
    expect(await new PlaybackRateStore().get()).toBe(1.5);
  });

  test('latest save wins', async () => {
    const store = new PlaybackRateStore();
    await store.save(1.25);
    await store.save(2);
    expect(await store.get()).toBe(2);
  });

  test('rejects an out-of-range rate', async () => {
    const store = new PlaybackRateStore();
    await store.save(99);
    expect(await store.get()).toBe(DEFAULT_PLAYBACK_RATE);
  });

  test('falls back to the default when the stored value is corrupt', async () => {
    mockFiles.set('/doc/playback-rate.json', '{"rate":"fast"}');
    expect(await new PlaybackRateStore().get()).toBe(DEFAULT_PLAYBACK_RATE);
  });
});
