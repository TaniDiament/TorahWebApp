import RNBlobUtil from 'react-native-blob-util';

/**
 * The user's chosen playback speed, persisted so it carries across tracks and
 * app launches — listeners who prefer 1.5× a shiur shouldn't have to reset it
 * every time. Stored as a single small JSON file in the document directory,
 * following the same best-effort pattern as {@link playbackPositions}.
 */

const { fs } = RNBlobUtil;
const STORE_PATH = `${fs.dirs.DocumentDir}/playback-rate.json`;

// The speeds the Now Playing speed control cycles through, in order. 1× must be
// present so the user can always get back to normal speed.
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const DEFAULT_PLAYBACK_RATE = 1;

// Guard against a corrupt file feeding the native player a nonsensical rate
// (which on iOS could mean silence or runaway speed). Accept a sane span only.
const isValidRate = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0.25 && n <= 4;

export class PlaybackRateStore {
  // In-memory mirror of the on-disk value, loaded once per session.
  private cache: number | null = null;

  /** The persisted playback rate, or the default if none/invalid is stored. */
  async get(): Promise<number> {
    if (this.cache != null) return this.cache;
    try {
      if (await fs.exists(STORE_PATH)) {
        const parsed = JSON.parse(await fs.readFile(STORE_PATH, 'utf8')) as { rate?: unknown };
        const raw = parsed?.rate;
        this.cache = isValidRate(raw) ? raw : DEFAULT_PLAYBACK_RATE;
      } else {
        this.cache = DEFAULT_PLAYBACK_RATE;
      }
    } catch {
      this.cache = DEFAULT_PLAYBACK_RATE;
    }
    return this.cache;
  }

  /** Remember `rate` for next time. Best-effort — a failed write is ignored. */
  async save(rate: number) {
    if (!isValidRate(rate)) return;
    this.cache = rate;
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({ rate }), 'utf8');
    } catch {
      // Best-effort — a failed write just means the speed resets next launch.
    }
  }
}

export const playbackRateStore = new PlaybackRateStore();
