# jniLibs/

Per-ABI subdirectories (`arm64-v8a/`, `armeabi-v7a/`, `x86_64/`, `x86/`) here
will contain `libtorah_search.so` after running:

```
../../../tantivy-bridge/build-android.sh
```

The `.so` files are build artefacts; consider gitignoring them and regenerating
on CI rather than committing binaries. Gradle picks up whatever it finds here
and bundles it into the APK automatically.
