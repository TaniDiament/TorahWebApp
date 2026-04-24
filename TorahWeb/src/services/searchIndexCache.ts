import RNBlobUtil from 'react-native-blob-util';

/**
 * On-device cache for the full-text search index. Follows the delta protocol
 * documented in /BACKEND_SCHEMA.md under "Search index (search/)".
 *
 * Layout on disk (DocumentDir):
 *   search-index.json      - full entries array, JSON serialized
 *   search-index.meta.json - { schemaVersion, version, generatedAt }
 */

const { fs } = RNBlobUtil;
const INDEX_PATH = `${fs.dirs.DocumentDir}/search-index.json`;
const META_PATH = `${fs.dirs.DocumentDir}/search-index.meta.json`;

export interface SearchEntry {
  id: string;
  type: 'article' | 'video' | 'audio';
  date: string;
  haystack: string;
}

interface IndexMeta {
  schemaVersion: number;
  version: number;
  generatedAt: string;
}

interface Manifest {
  schemaVersion: number;
  version: number;
  generatedAt: string;
  fullUrl: string;
  fullBytes: number;
  deltas: { from: number; url: string; bytes: number }[];
}

interface FullIndexFile {
  schemaVersion: number;
  version: number;
  generatedAt: string;
  entries: SearchEntry[];
}

interface DeltaFile {
  schemaVersion: number;
  from: number;
  to: number;
  generatedAt: string;
  added: SearchEntry[];
  updated: SearchEntry[];
  removed: string[];
}

export class SearchIndexCache {
  private entriesP?: Promise<SearchEntry[]>;

  constructor(private readonly baseUrl: string) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private async fetchJson<T>(relPath: string): Promise<T> {
    const res = await fetch(this.url(relPath));
    if (!res.ok) throw new Error(`${relPath} → ${res.status}`);
    return (await res.json()) as T;
  }

  private async readMeta(): Promise<IndexMeta | null> {
    try {
      if (!(await fs.exists(META_PATH))) return null;
      const raw = await fs.readFile(META_PATH, 'utf8');
      return JSON.parse(raw) as IndexMeta;
    } catch {
      return null;
    }
  }

  private async readEntries(): Promise<SearchEntry[] | null> {
    try {
      if (!(await fs.exists(INDEX_PATH))) return null;
      const raw = await fs.readFile(INDEX_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SearchEntry[]) : null;
    } catch {
      return null;
    }
  }

  private async write(entries: SearchEntry[], meta: IndexMeta) {
    await fs.writeFile(INDEX_PATH, JSON.stringify(entries), 'utf8');
    await fs.writeFile(META_PATH, JSON.stringify(meta), 'utf8');
  }

  private async clear() {
    try {
      if (await fs.exists(INDEX_PATH)) await fs.unlink(INDEX_PATH);
    } catch {}
    try {
      if (await fs.exists(META_PATH)) await fs.unlink(META_PATH);
    } catch {}
  }

  private applyDelta(entries: SearchEntry[], delta: DeltaFile): SearchEntry[] {
    const map = new Map(entries.map((e) => [e.id, e]));
    for (const id of delta.removed) map.delete(id);
    for (const e of delta.updated) map.set(e.id, e);
    for (const e of delta.added) map.set(e.id, e);
    return Array.from(map.values());
  }

  private pickDelta(manifest: Manifest, cachedVersion: number) {
    const candidates = manifest.deltas
      .filter((d) => d.from <= cachedVersion && d.from < manifest.version)
      .sort((a, b) => b.from - a.from);
    return candidates[0];
  }

  /**
   * Ensure the local cache matches the latest published version, then return
   * the entries array. Safe to call repeatedly — syncing happens at most once
   * per provider instance (the promise is memoized).
   */
  async getEntries(): Promise<SearchEntry[]> {
    return (this.entriesP ??= this.sync());
  }

  private async sync(): Promise<SearchEntry[]> {
    let manifest: Manifest;
    try {
      manifest = await this.fetchJson<Manifest>('search/index-manifest.json');
    } catch {
      const cached = await this.readEntries();
      if (cached) return cached;
      throw new Error('search: no manifest and no cache');
    }

    const meta = await this.readMeta();
    const cachedEntries = meta ? await this.readEntries() : null;

    const schemaMismatch = !meta || meta.schemaVersion !== manifest.schemaVersion;
    const cacheUsable = !!meta && !!cachedEntries && !schemaMismatch;

    if (cacheUsable && meta!.version === manifest.version) {
      return cachedEntries!;
    }

    if (cacheUsable) {
      const delta = this.pickDelta(manifest, meta!.version);
      if (delta && delta.bytes < manifest.fullBytes) {
        try {
          const payload = await this.fetchJson<DeltaFile>(delta.url);
          if (payload.schemaVersion === manifest.schemaVersion) {
            const next = this.applyDelta(cachedEntries!, payload);
            await this.write(next, {
              schemaVersion: manifest.schemaVersion,
              version: manifest.version,
              generatedAt: manifest.generatedAt,
            });
            return next;
          }
        } catch {
          // Fall through to full download.
        }
      }
    }

    if (schemaMismatch) await this.clear();
    const full = await this.fetchJson<FullIndexFile>(manifest.fullUrl);
    await this.write(full.entries, {
      schemaVersion: full.schemaVersion,
      version: full.version,
      generatedAt: full.generatedAt,
    });
    return full.entries;
  }
}

export const normalizeQuery = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
