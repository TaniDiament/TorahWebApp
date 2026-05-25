import { ContentProvider } from './provider';
import { MockProvider } from './mockProvider';
import { RealProvider } from './realProvider';

/**
 * The app reads live content from the static JSON backend described in
 * /BACKEND_SCHEMA.md, published at TORAHWEB_API_URL. Set `USE_REAL_BACKEND`
 * to `false` to fall back to the bundled mock data for offline UI work.
 * All screens go through the ContentProvider interface, so nothing else
 * needs to change either way.
 */
const USE_REAL_BACKEND = true;
const TORAHWEB_API_URL = 'https://www.torahweb.org/api/v1';

export const api: ContentProvider = USE_REAL_BACKEND
  ? new RealProvider(TORAHWEB_API_URL)
  : new MockProvider();
