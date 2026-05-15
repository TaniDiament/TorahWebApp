import RNBlobUtil from 'react-native-blob-util';
import { LuceneSearchIndex, LuceneIndexData } from './luceneSearch';

/**
 * On-device cache for the full-text search index. Follows the delta protocol
 * documented in /BACKEND_SCHEMA.md under "Search index (search/)".
 *
 * Layout on disk (DocumentDir):
 *   search-index.json      - full entries array, JSON serialized
 *   search-index.meta.json - { schemaVersion, version, generatedAt }
 *   search-lucene.json     - Lucene pre-computed inverted index
 */

const { fs } = RNBlobUtil;
const INDEX_PATH = `${fs.dirs.DocumentDir}/search-index.json`;
const META_PATH = `${fs.dirs.DocumentDir}/search-index.meta.json`;
const LUCENE_PATH = `${fs.dirs.DocumentDir}/search-lucene.json`;

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
  /** Version of the Lucene index file currently on disk, or null if absent. */
  luceneVersion: number | null;
}

interface Manifest {
  schemaVersion: number;
  version: number;
  generatedAt: string;
  fullUrl: string;
  fullBytes: number;
  luceneUrl: string;
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
  private luceneP?: Promise<LuceneSearchIndex>;

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
      const parsed = JSON.parse(raw) as Partial<IndexMeta>;
      if (
        typeof parsed.schemaVersion !== 'number' ||
        typeof parsed.version !== 'number' ||
        typeof parsed.generatedAt !== 'string'
      ) {
        return null;
      }
      // luceneVersion was added later — treat any pre-existing meta file
      // as "Lucene index unknown / stale" so we re-fetch on next sync.
      return {
        schemaVersion: parsed.schemaVersion,
        version: parsed.version,
        generatedAt: parsed.generatedAt,
        luceneVersion:
          typeof parsed.luceneVersion === 'number' ? parsed.luceneVersion : null,
      };
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

  private async writeEntries(entries: SearchEntry[]) {
    await fs.writeFile(INDEX_PATH, JSON.stringify(entries), 'utf8');
  }

  private async writeMeta(meta: IndexMeta) {
    await fs.writeFile(META_PATH, JSON.stringify(meta), 'utf8');
  }

  private async writeLucene(data: LuceneIndexData) {
    await fs.writeFile(LUCENE_PATH, JSON.stringify(data), 'utf8');
  }

  private async readLucene(): Promise<LuceneSearchIndex | null> {
    try {
      if (!(await fs.exists(LUCENE_PATH))) return null;
      const raw = await fs.readFile(LUCENE_PATH, 'utf8');
      const data = JSON.parse(raw) as LuceneIndexData;
      return LuceneSearchIndex.load(data);
    } catch {
      return null;
    }
  }

  private async clear() {
    try {
      if (await fs.exists(INDEX_PATH)) await fs.unlink(INDEX_PATH);
    } catch {}
    try {
      if (await fs.exists(META_PATH)) await fs.unlink(META_PATH);
    } catch {}
    try {
      if (await fs.exists(LUCENE_PATH)) await fs.unlink(LUCENE_PATH);
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

  /**
   * Return a ready-to-query LuceneSearchIndex. Downloads and caches the
   * Lucene inverted index JSON alongside the entries.
   */
  async getLuceneIndex(): Promise<LuceneSearchIndex> {
    return (this.luceneP ??= this.syncLucene());
  }

  private async syncLucene(): Promise<LuceneSearchIndex> {
    // Trigger the entries sync first — it handles manifest fetching,
    // delta application, and version tracking.
    await this.getEntries();

    // Only trust the cached Lucene index if meta records that it was
    // successfully fetched for the same version as the entries cache.
    const meta = await this.readMeta();
    if (meta && meta.luceneVersion === meta.version) {
      const cached = await this.readLucene();
      if (cached) return cached;
    }

    // Stale or missing — try a fresh fetch.
    try {
      const manifest = await this.fetchJson<Manifest>('search/index-manifest.json');
      if (manifest.luceneUrl) {
        const data = await this.fetchJson<LuceneIndexData>(manifest.luceneUrl);
        // Only commit the Lucene file (and update meta.luceneVersion) when
        // it lines up with the entries we have on disk. If something raced
        // and the entries are at a different version, return the freshly
        // downloaded index for this query but don't poison the cache.
        if (meta && meta.version === manifest.version) {
          await this.writeLucene(data);
          await this.writeMeta({ ...meta, luceneVersion: manifest.version });
        }
        return LuceneSearchIndex.load(data);
      }
    } catch {
      // If Lucene index unavailable, return an empty index
    }
    return LuceneSearchIndex.load({
      schemaVersion: 2,
      analyzer: 'EnglishAnalyzer',
      scoring: { scorer: 'BM25', k1: 1.2, b: 0.75 },
      docCount: 0,
      fields: [],
      docLens: {},
      terms: {},
    });
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
      // Entries are current; the Lucene cache may still be stale (e.g. a
      // previous sync failed mid-flight). Top it up opportunistically.
      if (meta!.luceneVersion !== meta!.version) {
        await this.fetchAndCacheLucene(manifest, meta!);
      }
      return cachedEntries!;
    }

    if (cacheUsable) {
      const delta = this.pickDelta(manifest, meta!.version);
      if (delta && delta.bytes < manifest.fullBytes) {
        try {
          const payload = await this.fetchJson<DeltaFile>(delta.url);
          if (payload.schemaVersion === manifest.schemaVersion) {
            const next = this.applyDelta(cachedEntries!, payload);
            await this.writeEntries(next);
            // Mark meta as advanced but the Lucene index as not-yet-fetched.
            // fetchAndCacheLucene will flip luceneVersion to the new version
            // iff its download succeeds.
            const nextMeta: IndexMeta = {
              schemaVersion: manifest.schemaVersion,
              version: manifest.version,
              generatedAt: manifest.generatedAt,
              luceneVersion: null,
            };
            await this.writeMeta(nextMeta);
            await this.fetchAndCacheLucene(manifest, nextMeta);
            return next;
          }
        } catch {
          // Fall through to full download.
        }
      }
    }

    if (schemaMismatch) await this.clear();
    const full = await this.fetchJson<FullIndexFile>(manifest.fullUrl);
    await this.writeEntries(full.entries);
    const nextMeta: IndexMeta = {
      schemaVersion: full.schemaVersion,
      version: full.version,
      generatedAt: full.generatedAt,
      luceneVersion: null,
    };
    await this.writeMeta(nextMeta);
    await this.fetchAndCacheLucene(manifest, nextMeta);
    return full.entries;
  }

  /**
   * Download the Lucene index referenced by `manifest` and persist it,
   * but only flip `meta.luceneVersion` to the new value after the file is
   * safely on disk. If the fetch fails, the entries cache moves forward
   * while `meta.luceneVersion` stays behind — the next call to
   * `getLuceneIndex()` will retry the download.
   */
  private async fetchAndCacheLucene(manifest: Manifest, meta: IndexMeta) {
    try {
      if (!manifest.luceneUrl) return;
      const data = await this.fetchJson<LuceneIndexData>(manifest.luceneUrl);
      await this.writeLucene(data);
      await this.writeMeta({ ...meta, luceneVersion: manifest.version });
      // Reset memoized promise so next getLuceneIndex() picks up fresh data.
      this.luceneP = undefined;
    } catch {
      // Lucene index is optional — search degrades to haystack matching.
      // meta.luceneVersion stays null/stale; readLucene() in syncLucene()
      // will fall through to a fresh fetch attempt.
    }
  }
}

export const normalizeQuery = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
