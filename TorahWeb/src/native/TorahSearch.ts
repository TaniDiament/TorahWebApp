import { NativeModules } from 'react-native';

/**
 * TypeScript façade over the `TorahSearch` native module (Kotlin on Android,
 * Swift on iOS — both wrap the Rust crate at `tantivy-bridge/`).
 *
 * Methods are 1:1 with the bridge:
 *  - `open(path)`  – point the engine at a directory of Tantivy files.
 *  - `query(q,n)`  – run a query, get back JSON `[{id,score},...]`.
 *  - `close()`     – release the index.
 *
 * The native module is registered as an in-app module rather than an npm
 * package, so it isn't autolinked. Android wires it up in
 * `MainApplication.kt`; iOS wires it up by adding `TorahSearch.swift`/`.m`
 * + the xcframework to the Xcode target. See
 * `tantivy-bridge/README.md` for the build flow.
 */
export interface TorahSearchHit {
  id: string;
  score: number;
}

interface TorahSearchNativeModule {
  open(path: string): Promise<boolean>;
  query(query: string, limit: number): Promise<string>;
  close(): Promise<void>;
}

const native = NativeModules.TorahSearch as TorahSearchNativeModule | undefined;

export const isNativeSearchAvailable = !!native;

export const TorahSearchNative = {
  async open(path: string): Promise<void> {
    if (!native) throw new Error('TorahSearch native module is not linked');
    await native.open(path);
  },
  async query(query: string, limit: number): Promise<TorahSearchHit[]> {
    if (!native) throw new Error('TorahSearch native module is not linked');
    const json = await native.query(query, limit);
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? (parsed as TorahSearchHit[]) : [];
    } catch {
      return [];
    }
  },
  async close(): Promise<void> {
    if (!native) return;
    await native.close();
  },
};
