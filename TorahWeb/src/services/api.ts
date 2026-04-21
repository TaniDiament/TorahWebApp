import { ContentProvider } from './provider';
import { MockProvider } from './mockProvider';
import { RealProvider } from './realProvider';

/**
 * Flip this to `true` (and set TORAHWEB_API_URL) once the owner's backend is
 * deployed. All screens go through the ContentProvider interface, so no other
 * files should need to change.
 */
const USE_REAL_BACKEND = false;
const TORAHWEB_API_URL = 'https://api.torahweb.org';

export const api: ContentProvider = USE_REAL_BACKEND
  ? new RealProvider(TORAHWEB_API_URL)
  : new MockProvider();
