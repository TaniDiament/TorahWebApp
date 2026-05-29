import RNBlobUtil from 'react-native-blob-util';

/**
 * On-disk cache for the catalog files (authors / topics / content / recent /
 * this-week / events), validated against the backend's manifest.json — the
 * design /BACKEND_SCHEMA.md spells out ("the app always re-validates
 * manifest.json on launch; every other file ... is reused from local cache" so
 * long as its hash is unchanged).
 *
 * This is the catalog counterpart to SearchIndexCache. Without it the catalog
 * was only memoized in memory, so every cold start re-downloaded content.json
 * (~4800 entries) and the app couldn't browse anything offline.
 *
 * Layout on disk (DocumentDir), one pair per manifest hash key:
 *   catalog-<key>.json       - the cached file body, JSON serialized
 *   catalog-<key>.meta.json  - { hash, version } recorded when it was cached
 */

const { fs } = RNBlobUtil;

export interface CatalogManifest {
  version: number;
  generatedAt: string;
  counts: { authors: number; topics: number; content: number };
  /** SHA-256 of each top-level file, keyed by logical name (authors, content…). */
  hashes: Record<string, string>;
}

interface FileMeta {
  /** The manifest hash that was current when this file was written to disk. */
  hash: string;
  version: number;
}

export class CatalogCache {
  private manifestP?: Promise<CatalogManifest | null>;
  // Per-key memoization so concurrent reads of the same file dedupe within a
  // session. Cleared on failure (see getFile) so a retry re-attempts rather
  // than replaying a stale rejection.
  private readonly fileP = new Map<string, Promise<unknown>>();

  constructor(private readonly baseUrl: string) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private async fetchJson<T>(relPath: string): Promise<T> {
    const res = await fetch(this.url(relPath));
    if (!res.ok) throw new Error(`${relPath} → ${res.status}`);
    return (await res.json()) as T;
  }

  private dataPath(key: string) {
    return `${fs.dirs.DocumentDir}/catalog-${key}.json`;
  }
  private metaPath(key: string) {
    return `${fs.dirs.DocumentDir}/catalog-${key}.meta.json`;
  }

  private async readDisk<T>(key: string): Promise<T | null> {
    try {
      const path = this.dataPath(key);
      if (!(await fs.exists(path))) return null;
      return JSON.parse(await fs.readFile(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private async readMeta(key: string): Promise<FileMeta | null> {
    try {
      const path = this.metaPath(key);
      if (!(await fs.exists(path))) return null;
      const parsed = JSON.parse(await fs.readFile(path, 'utf8')) as Partial<FileMeta>;
      if (typeof parsed.hash !== 'string' || typeof parsed.version !== 'number') {
        return null;
      }
      return { hash: parsed.hash, version: parsed.version };
    } catch {
      return null;
    }
  }

  private async writeDisk(key: string, data: unknown, meta: FileMeta) {
    // Write the body first; only record meta (the "cached at hash H"
    // commitment) once the body is safely on disk, so a crash mid-write can't
    // leave us trusting a half-written file.
    await fs.writeFile(this.dataPath(key), JSON.stringify(data), 'utf8');
    await fs.writeFile(this.metaPath(key), JSON.stringify(meta), 'utf8');
  }

  private manifest(): Promise<CatalogManifest | null> {
    return (this.manifestP ??= this.fetchManifest().then((m) => {
      // A null result means offline/unreachable — don't memoize it, so a later
      // call (e.g. after the network returns) re-attempts instead of staying
      // stuck on disk for the whole session. A real manifest is kept: per the
      // schema we revalidate at most once per launch.
      if (m === null) this.manifestP = undefined;
      return m;
    }));
  }

  private async fetchManifest(): Promise<CatalogManifest | null> {
    try {
      return await this.fetchJson<CatalogManifest>('manifest.json');
    } catch {
      return null;
    }
  }

  /**
   * Return the parsed catalog file for `key` (remote `filename`). Reuses the
   * on-disk copy when the manifest says its hash is unchanged; otherwise
   * fetches, persists, and records the new hash. Falls back to the last cached
   * copy whenever the network is unavailable, so the catalog browses offline.
   */
  getFile<T>(key: string, filename: string): Promise<T> {
    const existing = this.fileP.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const p = this.loadFile<T>(key, filename).catch((err) => {
      // Don't cache failures — clear the slot so a retry re-attempts.
      this.fileP.delete(key);
      throw err;
    });
    this.fileP.set(key, p);
    return p;
  }

  private async loadFile<T>(key: string, filename: string): Promise<T> {
    const manifest = await this.manifest();

    // No manifest → offline / unreachable. Serve the cached copy if we have
    // one; only as a last resort hit the network directly (likely to fail).
    if (!manifest) {
      const disk = await this.readDisk<T>(key);
      if (disk !== null) return disk;
      return this.fetchJson<T>(filename);
    }

    const wantHash = manifest.hashes?.[key];
    if (wantHash) {
      const meta = await this.readMeta(key);
      if (meta && meta.hash === wantHash) {
        const disk = await this.readDisk<T>(key);
        if (disk !== null) return disk;
      }
    }

    // Hash changed, no usable cached copy, or manifest didn't list this file →
    // fetch fresh.
    try {
      const data = await this.fetchJson<T>(filename);
      if (wantHash) {
        try {
          await this.writeDisk(key, data, { hash: wantHash, version: manifest.version });
        } catch {
          // Persisting failed (disk full, etc.) — still return the fresh data;
          // we just won't have it cached for next launch.
        }
      }
      return data;
    } catch (err) {
      // Network failed mid-session despite having a manifest — serve stale.
      const disk = await this.readDisk<T>(key);
      if (disk !== null) return disk;
      throw err;
    }
  }
}
