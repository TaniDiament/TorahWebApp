# TorahSearch (iOS)

Native Tantivy bridge for the iOS app.

## Files

- `TorahSearch.swift` — `@objc` class that wraps the C ABI from
  `libtorah_search.a` (returns Promises to JS).
- `TorahSearch.m` — `RCT_EXTERN_MODULE` macro that registers the Swift class
  with React Native's bridge.
- `TorahSearch-Bridging-Header.h` — imports the cbindgen-generated header so
  Swift can see `torah_search_open` / `torah_search_query` / etc.
- `TorahSearch.xcframework` (generated, gitignored) — built by
  `../../tantivy-bridge/build-ios.sh`.

## One-time Xcode setup

After running `build-ios.sh`:

1. Open `TorahWeb.xcodeproj` in Xcode.
2. Drag `TorahSearch.xcframework` into the project navigator under the
   `TorahWeb` target (check "Copy items if needed", target = `TorahWeb`).
3. In **Build Settings → Objective-C Bridging Header**, set the path to
   `TorahSearch/TorahSearch-Bridging-Header.h`.
4. Drag `TorahSearch.swift` and `TorahSearch.m` into the project navigator
   under the `TorahWeb` target. Xcode will offer to create the
   `TorahWeb-Bridging-Header.h` automatically — point it at the file from
   step 3 instead so we don't end up with two.
5. Build & run.

The xcframework is the only artefact that needs rebuilding when the Rust
side changes; the `.swift`/`.m`/`.h` files are stable.
