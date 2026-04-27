# tantivy-bridge

Native Rust crate that opens a Tantivy index and exposes a tiny FFI surface
the React Native app calls into.

## What it exports

```rust
// C ABI (consumed by iOS via Swift)
torah_search_open(path: *const c_char) -> i32   // 0 on success, < 0 on error
torah_search_query(query: *const c_char, limit: u32) -> *mut c_char  // JSON
torah_search_free(ptr: *mut c_char)              // free strings from query()
torah_search_close()                             // release the index

// JNI ABI (consumed by Android directly from Kotlin)
Java_com_torahweb_search_TorahSearchModule_nativeOpen
Java_com_torahweb_search_TorahSearchModule_nativeQuery
Java_com_torahweb_search_TorahSearchModule_nativeClose
```

`torah_search_query` returns a JSON string of `[{"id":"...","score":1.23},...]`
ranked by BM25 with field boosts:

| Field          | Boost |
| -------------- | ----- |
| `title`        | 5.0   |
| `author_name`  | 3.0   |
| `topic_names`  | 3.0   |
| `parsha`       | 3.0   |
| `excerpt`      | 2.0   |
| `body`         | 1.0   |
| `description`  | 1.0   |

The QueryParser is set to AND-by-default so `"hilchos pesach"` requires both
terms in some field combination, not either.

## Schema contract

Field names here must match the schema produced by
`Jsongenerators/_common.py::_build_schema`. If you add a field on one side,
add it on the other.

## Building for Android

```
rustup target add aarch64-linux-android armv7-linux-androideabi \
                  x86_64-linux-android i686-linux-android
cargo install cargo-ndk
export ANDROID_NDK_HOME=/path/to/android-ndk
./build-android.sh
```

The script writes `libtorah_search.so` into
`../android/app/src/main/jniLibs/<abi>/`. Gradle picks them up automatically.

## Building for iOS (macOS only)

```
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
cargo install cbindgen
./build-ios.sh
```

The script lipo's the simulator slices, generates a C header with cbindgen,
and bundles `TorahSearch.xcframework` into `../ios/TorahSearch/`. Drag it
into the Xcode project once; subsequent rebuilds just overwrite in place.

## Field-by-field debugging

To print the full Tantivy explanation for a hit (helpful when boosts feel
off), open the index with `tantivy::Index::open_in_dir(path)` from a one-off
binary and call `searcher.explain(&q, addr)`. The bridge intentionally
doesn't surface this through FFI to keep the JS-facing API small.
