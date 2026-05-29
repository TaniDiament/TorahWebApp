/**
 * Unit tests for the resume-position store. In-memory filesystem (overriding
 * the global react-native-blob-util mock for this file) so we can verify the
 * save / get / threshold / clear behavior and cross-session persistence.
 */
import { PlaybackPositionStore } from '../src/audio/playbackPositions';

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
      unlink: jest.fn((p: string) => {
        mockFiles.delete(p);
        return Promise.resolve();
      }),
    },
  },
}));

beforeEach(() => mockFiles.clear());

describe('PlaybackPositionStore', () => {
  test('persists a position and reads it back in a fresh session', async () => {
    await new PlaybackPositionStore().save('a', 120, 600);
    // New instance = cold start; must read from disk, not memory.
    expect(await new PlaybackPositionStore().getPosition('a')).toBe(120);
  });

  test('ignores positions too close to the start', async () => {
    const store = new PlaybackPositionStore();
    await store.save('b', 3, 600); // < MIN_RESUME_SEC
    expect(await store.getPosition('b')).toBe(0);
  });

  test('treats a near-the-end position as finished (not saved)', async () => {
    const store = new PlaybackPositionStore();
    await store.save('c', 595, 600); // within END_THRESHOLD_SEC of the end
    expect(await store.getPosition('c')).toBe(0);
  });

  test('saving near the end clears a previously stored position', async () => {
    const store = new PlaybackPositionStore();
    await store.save('d', 100, 600);
    expect(await store.getPosition('d')).toBe(100);
    await store.save('d', 599, 600); // finished now
    expect(await store.getPosition('d')).toBe(0);
  });

  test('clear() forgets a track', async () => {
    const store = new PlaybackPositionStore();
    await store.save('e', 200, 600);
    await store.clear('e');
    expect(await store.getPosition('e')).toBe(0);
  });

  test('latest save wins', async () => {
    const store = new PlaybackPositionStore();
    await store.save('f', 50, 600);
    await store.save('f', 240, 600);
    expect(await store.getPosition('f')).toBe(240);
  });

  test('unknown id resolves to 0', async () => {
    expect(await new PlaybackPositionStore().getPosition('nope')).toBe(0);
  });
});
