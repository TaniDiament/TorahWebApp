#!/usr/bin/env bash
# Cross-compile libtorah_search.so for every Android ABI we ship and drop
# the .so files into the Android project's jniLibs/ tree.
#
# Requirements:
#   - Rust toolchain with the four Android targets installed:
#       rustup target add aarch64-linux-android armv7-linux-androideabi \
#                         x86_64-linux-android i686-linux-android
#   - cargo-ndk (cargo install cargo-ndk)
#   - Android NDK (set ANDROID_NDK_HOME)
#
# Run from the repo root or this directory; either works.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v cargo-ndk >/dev/null 2>&1; then
  echo "cargo-ndk not found. Install with: cargo install cargo-ndk" >&2
  exit 1
fi

if [ -z "${ANDROID_NDK_HOME:-}" ] && [ -z "${NDK_HOME:-}" ]; then
  echo "ANDROID_NDK_HOME (or NDK_HOME) must point at your Android NDK install." >&2
  exit 1
fi

JNI_OUT="../android/app/src/main/jniLibs"
mkdir -p "$JNI_OUT"

# --release builds with thin LTO and stripped symbols (see Cargo.toml).
cargo ndk \
  -t arm64-v8a \
  -t armeabi-v7a \
  -t x86_64 \
  -t x86 \
  -o "$JNI_OUT" \
  build --release

echo
echo "Android libraries written to: $JNI_OUT"
ls "$JNI_OUT"
