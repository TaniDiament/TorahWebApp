import RNBlobUtil from 'react-native-blob-util';
import { TorahSearchNative, isNativeSearchAvailable } from '../native/TorahSearch';

/**
 * On-device cache for the Tantivy search index. The site publishes a
 * directory of binary segment files under `search/tantivy-v{N}/` plus a
 * pointer at `search/index-manifest.json`:
 *
 *   {
 *     "schemaVersion": 1,
 *     "version": N,
 *     "tantivy": {
 *       "indexDir": "search/tantivy-vN/",
 *       "files": [{ "name": "...", "size": ..., "sha256": "..." }, ...]
 *     }
 *   }
 *
 * On sync we mirror that directory into DocumentDir, reusing any file from
 * a previous version whose sha256 still matches (delta-by-file). Once the
 * mirror is consistent the native Rust reader is opened against it.
 */

const { fs } = RNBlobUtil;
const ROOT = `${fs.dirs.DocumentDir}/tantivy-index`;
const META_PATH = `${ROOT}/meta.json`;

interface ManifestFile {
  name: string;
  size: number;
  sha256: string;
}

interface TantivyManifest {
  schemaVersion: number;
  version: number;
  generatedAt: string;
  tantivy: {
    indexDir: string;
    totalBytes: number;
    files: ManifestFile[];
  };
}

interface CacheMeta {
  schemaVersion: number;
  version: number;
  generatedAt: string;
  dirName: string;
}

const FILENAME_RE = /^[A-Za-z0-9._-]+$/;

const join = (a: string, b: string) =>
  `${a.replace(/\/$/, '')}/${b.replace(/^\//, '')}`;

const lower = (s: string) => s.toLowerCase();

export class TantivyIndexCache {
  private openP?: Promise<string | null>;
  private openedDir: string | null = null;

  constructor(private readonly baseUrl: string) {}

  /** Ensure the local cache matches the published version and the native
   *  engine is opened against it. Returns the local index path on success,
   *  or null if native search is unavailable / sync failed. Memoized. */
  ensureReady(): Promise<string | null> {
    return (this.openP ??= this.sync());
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private async fetchManifest(): Promise<TantivyManifest> {
    const res = await fetch(this.url('search/index-manifest.json'));
    if (!res.ok) throw new Error(`index-manifest → ${res.status}`);
    const parsed = (await res.json()) as TantivyManifest;
    if (!parsed?.tantivy?.files || !Array.isArray(parsed.tantivy.files)) {
      throw new Error('index-manifest: missing tantivy.files');
    }
    return parsed;
  }

  private async readMeta(): Promise<CacheMeta | null> {
    try {
      if (!(await fs.exists(META_PATH))) return null;
      const raw = await fs.readFile(META_PATH, 'utf8');
      return JSON.parse(raw) as CacheMeta;
    } catch {
      return null;
    }
  }

  private async writeMeta(meta: CacheMeta) {
    await fs.writeFile(META_PATH, JSON.stringify(meta), 'utf8');
  }

  private async ensureRoot() {
    if (!(await fs.exists(ROOT))) await fs.mkdir(ROOT);
  }

  private async hashFile(path: string): Promise<string | null> {
    try {
      const h = await fs.hash(path, 'sha256');
      return typeof h === 'string' ? lower(h) : null;
    } catch {
      return null;
    }
  }

  private async listVersionDirs(): Promise<string[]> {
    try {
      const entries = await fs.ls(ROOT);
      return entries.filter((n) => /^v\d+$/.test(n));
    } catch {
      return [];
    }
  }

  private async download(remoteUrl: string, dest: string): Promise<void> {
    if (await fs.exists(dest)) await fs.unlink(dest);
    const task = RNBlobUtil.config({ path: dest, fileCache: false }).fetch(
      'GET',
      remoteUrl,
    );
    const res = await task;
    const status = res.info().status;
    if (status < 200 || status >= 300) {
      try {
        await fs.unlink(dest);
      } catch {}
      throw new Error(`download ${remoteUrl} → ${status}`);
    }
  }

  private async cleanupOtherVersions(keepDir: string) {
    const dirs = await this.listVersionDirs();
    await Promise.all(
      dirs
        .filter((d) => d !== keepDir)
        .map(async (d) => {
          try {
            await fs.unlink(join(ROOT, d));
          } catch {}
        }),
    );
  }

  private async sync(): Promise<string | null> {
    if (!isNativeSearchAvailable) return null;

    let manifest: TantivyManifest;
    try {
      manifest = await this.fetchManifest();
    } catch {
      // Offline or 404 — try to reopen whatever's already on disk.
      const meta = await this.readMeta();
      if (!meta) return null;
      const localDir = join(ROOT, meta.dirName);
      if (!(await fs.exists(localDir))) return null;
      try {
        await TorahSearchNative.open(localDir);
        this.openedDir = localDir;
        return localDir;
      } catch {
        return null;
      }
    }

    await this.ensureRoot();

    const targetDirName = `v${manifest.version}`;
    const targetDir = join(ROOT, targetDirName);
    const meta = await this.readMeta();

    // Fast path: same version already mirrored.
    if (
      meta &&
      meta.schemaVersion === manifest.schemaVersion &&
      meta.version === manifest.version &&
      meta.dirName === targetDirName &&
      (await fs.exists(targetDir))
    ) {
      if (this.openedDir === targetDir) return targetDir;
      await TorahSearchNative.open(targetDir);
      this.openedDir = targetDir;
      return targetDir;
    }

    // Schema bump invalidates everything we have on disk.
    if (meta && meta.schemaVersion !== manifest.schemaVersion) {
      try {
        if (await fs.exists(ROOT)) await fs.unlink(ROOT);
      } catch {}
      await this.ensureRoot();
    }

    // Build (or repair) the target directory.
    if (!(await fs.exists(targetDir))) await fs.mkdir(targetDir);

    const oldDirName = meta?.dirName;
    const oldDir = oldDirName ? join(ROOT, oldDirName) : null;

    const remoteDirRel = manifest.tantivy.indexDir;

    for (const f of manifest.tantivy.files) {
      if (!FILENAME_RE.test(f.name)) {
        throw new Error(`tantivy: refusing suspicious filename "${f.name}"`);
      }
      const wantSha = lower(f.sha256);
      const dest = join(targetDir, f.name);

      if (await fs.exists(dest)) {
        const got = await this.hashFile(dest);
        if (got === wantSha) continue;
        try {
          await fs.unlink(dest);
        } catch {}
      }

      // Reuse from previous version dir if the bytes already match.
      if (oldDir && oldDir !== targetDir) {
        const candidate = join(oldDir, f.name);
        if (await fs.exists(candidate)) {
          const got = await this.hashFile(candidate);
          if (got === wantSha) {
            try {
              await fs.cp(candidate, dest);
              const verify = await this.hashFile(dest);
              if (verify === wantSha) continue;
              await fs.unlink(dest);
            } catch {
              // Fall through to download.
            }
          }
        }
      }

      await this.download(this.url(join(remoteDirRel, f.name)), dest);
      const got = await this.hashFile(dest);
      if (got !== wantSha) {
        try {
          await fs.unlink(dest);
        } catch {}
        throw new Error(`tantivy: sha mismatch for ${f.name}`);
      }
    }

    // Drop any stray files in targetDir that aren't in the manifest.
    try {
      const want = new Set(manifest.tantivy.files.map((f) => f.name));
      const have = await fs.ls(targetDir);
      await Promise.all(
        have
          .filter((n) => !want.has(n))
          .map(async (n) => {
            try {
              await fs.unlink(join(targetDir, n));
            } catch {}
          }),
      );
    } catch {}

    await this.writeMeta({
      schemaVersion: manifest.schemaVersion,
      version: manifest.version,
      generatedAt: manifest.generatedAt,
      dirName: targetDirName,
    });

    await TorahSearchNative.open(targetDir);
    this.openedDir = targetDir;
    await this.cleanupOtherVersions(targetDirName);
    return targetDir;
  }

  async query(text: string, limit: number) {
    const ready = await this.ensureReady();
    if (!ready) return [];
    return TorahSearchNative.query(text, limit);
  }
}
