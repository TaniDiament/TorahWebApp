/**
 * Unit tests for the manifest-validated catalog cache (optimization #5).
 *
 * Uses an in-memory filesystem (overriding the global react-native-blob-util
 * mock for this file) and a controllable `fetch` so we can exercise the
 * fetch / reuse-disk / re-fetch-on-hash-change / offline-fallback branches.
 */
import { CatalogCache } from '../src/services/catalogCache';

// `mock`-prefixed so the jest.mock factory may reference it (jest hoisting rule).
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

const BASE = 'https://example.test/api/v1';

type Route = { ok: boolean; status?: number; json?: () => Promise<unknown> } | 'network-error';

let routes: Record<string, Route> = {};
let fetchCalls: string[] = [];

const okJson = (body: unknown): Route => ({
  ok: true,
  json: () => Promise.resolve(body),
});

const manifest = (hashes: Record<string, string>, version = 1): Route =>
  okJson({ version, generatedAt: 't', counts: { authors: 0, topics: 0, content: 0 }, hashes });

beforeEach(() => {
  mockFiles.clear();
  routes = {};
  fetchCalls = [];
  (globalThis as any).fetch = jest.fn((url: string) => {
    fetchCalls.push(url);
    const suffix = Object.keys(routes).find((s) => url.endsWith(s));
    const route = suffix ? routes[suffix] : undefined;
    if (!route) return Promise.resolve({ ok: false, status: 404 });
    if (route === 'network-error') return Promise.reject(new Error('offline'));
    return Promise.resolve(route);
  });
});

const fetchedFile = (name: string) => fetchCalls.some((u) => u.endsWith(name));

describe('CatalogCache', () => {
  test('first load fetches the file and persists it to disk', async () => {
    routes = {
      'manifest.json': manifest({ authors: 'h1' }),
      'authors.json': okJson([{ id: 'a', slug: 'a', name: 'A' }]),
    };
    const out = await new CatalogCache(BASE).getFile('authors', 'authors.json');
    expect(out).toEqual([{ id: 'a', slug: 'a', name: 'A' }]);
    expect(mockFiles.has('/doc/catalog-authors.json')).toBe(true);
    expect(mockFiles.has('/doc/catalog-authors.meta.json')).toBe(true);
  });

  test('reuses the disk copy when the manifest hash is unchanged', async () => {
    routes = {
      'manifest.json': manifest({ authors: 'h1' }),
      'authors.json': okJson([{ id: 'a', slug: 'a', name: 'A' }]),
    };
    // Session 1 populates disk.
    await new CatalogCache(BASE).getFile('authors', 'authors.json');

    // Session 2: fresh instance, same disk, same hash, but the server now would
    // return something different — proving we read from disk, not the network.
    fetchCalls = [];
    routes = {
      'manifest.json': manifest({ authors: 'h1' }),
      'authors.json': okJson([{ id: 'SHOULD_NOT_BE_USED' }]),
    };
    const out = await new CatalogCache(BASE).getFile('authors', 'authors.json');
    expect(out).toEqual([{ id: 'a', slug: 'a', name: 'A' }]);
    expect(fetchedFile('authors.json')).toBe(false);
    expect(fetchedFile('manifest.json')).toBe(true); // manifest is always revalidated
  });

  test('re-fetches when the manifest hash changes', async () => {
    routes = {
      'manifest.json': manifest({ authors: 'h1' }),
      'authors.json': okJson([{ id: 'old' }]),
    };
    await new CatalogCache(BASE).getFile('authors', 'authors.json');

    fetchCalls = [];
    routes = {
      'manifest.json': manifest({ authors: 'h2' }, 2),
      'authors.json': okJson([{ id: 'new' }]),
    };
    const out = await new CatalogCache(BASE).getFile<{ id: string }[]>('authors', 'authors.json');
    expect(out).toEqual([{ id: 'new' }]);
    expect(fetchedFile('authors.json')).toBe(true);
  });

  test('serves the cached copy when the manifest is unreachable (offline)', async () => {
    routes = {
      'manifest.json': manifest({ authors: 'h1' }),
      'authors.json': okJson([{ id: 'a' }]),
    };
    await new CatalogCache(BASE).getFile('authors', 'authors.json'); // populate disk

    routes = { 'manifest.json': 'network-error', 'authors.json': 'network-error' };
    const out = await new CatalogCache(BASE).getFile('authors', 'authors.json');
    expect(out).toEqual([{ id: 'a' }]);
  });

  test('rejects when offline with nothing cached', async () => {
    routes = { 'manifest.json': 'network-error', 'authors.json': 'network-error' };
    await expect(
      new CatalogCache(BASE).getFile('authors', 'authors.json'),
    ).rejects.toThrow();
  });

  test('a failed load is not memoized — a later call retries', async () => {
    routes = { 'manifest.json': 'network-error', 'authors.json': 'network-error' };
    const cache = new CatalogCache(BASE);
    await expect(cache.getFile('authors', 'authors.json')).rejects.toThrow();

    // Network returns; the same instance should re-attempt rather than replay
    // the cached rejection.
    routes = {
      'manifest.json': manifest({ authors: 'h1' }),
      'authors.json': okJson([{ id: 'a' }]),
    };
    const out = await cache.getFile('authors', 'authors.json');
    expect(out).toEqual([{ id: 'a' }]);
  });
});
