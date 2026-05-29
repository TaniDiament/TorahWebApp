import RNBlobUtil from 'react-native-blob-util';

/**
 * Per-track playback positions, persisted so a shiur resumes where the listener
 * left off across app launches. Keyed by content id (the same id used whether a
 * track is streamed or played from a download), stored as a single JSON map in
 * the device document directory.
 *
 * Saved opportunistically by AudioPlayerProvider (throttled during playback, on
 * pause, on close, and when the app backgrounds) and cleared when a track plays
 * to its end so a finished shiur replays from the start.
 */

const { fs } = RNBlobUtil;
const STORE_PATH = `${fs.dirs.DocumentDir}/playback-positions.json`;

// Within this many seconds of the end, treat the track as finished — don't save
// a position that would make "resume" drop the listener at the very end.
const END_THRESHOLD_SEC = 15;
// Below this many seconds in, there's nothing worth resuming — just start over.
const MIN_RESUME_SEC = 5;
// Cap the map so a heavy listener's history can't grow without bound.
const MAX_ENTRIES = 500;

export interface PlaybackPosition {
  position: number;
  duration: number;
  updatedAt: string;
}

type Store = Record<string, PlaybackPosition>;

export class PlaybackPositionStore {
  // In-memory mirror of the on-disk map, loaded once per session.
  private cache: Store | null = null;

  private async read(): Promise<Store> {
    if (this.cache) return this.cache;
    try {
      if (await fs.exists(STORE_PATH)) {
        const parsed = JSON.parse(await fs.readFile(STORE_PATH, 'utf8'));
        this.cache = parsed && typeof parsed === 'object' ? (parsed as Store) : {};
      } else {
        this.cache = {};
      }
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private async write(store: Store) {
    this.cache = store;
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify(store), 'utf8');
    } catch {
      // Best-effort — a failed write just means we won't resume this one.
    }
  }

  /** Saved resume position for `id` in seconds, or 0 if there's nothing useful. */
  async getPosition(id: string): Promise<number> {
    if (!id) return 0;
    const store = await this.read();
    return store[id]?.position ?? 0;
  }

  /**
   * Record the current position for `id`. A position past the end threshold or
   * before the minimum is dropped rather than stored, so resume only ever lands
   * somewhere meaningful.
   */
  async save(id: string, position: number, duration: number) {
    if (!id || !Number.isFinite(position)) return;
    const store = await this.read();

    const nearEnd = duration > 0 && position >= duration - END_THRESHOLD_SEC;
    if (position < MIN_RESUME_SEC || nearEnd) {
      if (store[id]) {
        delete store[id];
        await this.write(store);
      }
      return;
    }

    store[id] = { position, duration, updatedAt: new Date().toISOString() };
    this.evictIfNeeded(store);
    await this.write(store);
  }

  /** Forget `id` — used when a track plays to completion. */
  async clear(id: string) {
    if (!id) return;
    const store = await this.read();
    if (store[id]) {
      delete store[id];
      await this.write(store);
    }
  }

  // Drop the least-recently-updated entries once the map exceeds the cap.
  private evictIfNeeded(store: Store) {
    const ids = Object.keys(store);
    if (ids.length <= MAX_ENTRIES) return;
    ids
      .sort((a, b) => store[a].updatedAt.localeCompare(store[b].updatedAt))
      .slice(0, ids.length - MAX_ENTRIES)
      .forEach((id) => delete store[id]);
  }
}

export const playbackPositions = new PlaybackPositionStore();
