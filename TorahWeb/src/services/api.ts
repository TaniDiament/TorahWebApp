import { ContentProvider } from './provider';
import { MockProvider } from './mockProvider';
import { RealProvider } from './realProvider';

/**
 * Flip this to `true` once the static JSON files described in
 * /BACKEND_SCHEMA.md are published at TORAHWEB_API_URL. All screens go through
 * the ContentProvider interface, so no other files should need to change.
 */
const USE_REAL_BACKEND = false;
const TORAHWEB_API_URL = 'https://www.torahweb.org/api/v1';

export const api: ContentProvider = USE_REAL_BACKEND
  ? new RealProvider(TORAHWEB_API_URL)
  : new MockProvider();
