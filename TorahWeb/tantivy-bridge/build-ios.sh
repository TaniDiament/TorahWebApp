#!/usr/bin/env bash
# Build a universal xcframework for iOS device + simulator and copy it into
# the iOS project. Requires:
#   - macOS host with Xcode installed
#   - rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
#   - cbindgen (cargo install cbindgen)
set -euo pipefail

cd "$(dirname "$0")"

if [ "$(uname)" != "Darwin" ]; then
  echo "iOS builds require macOS." >&2
  exit 1
fi
if ! command -v cbindgen >/dev/null 2>&1; then
  echo "cbindgen not found. Install with: cargo install cbindgen" >&2
  exit 1
fi

# 1. Compile static libs for all three iOS slices.
cargo build --release --target aarch64-apple-ios
cargo build --release --target aarch64-apple-ios-sim
cargo build --release --target x86_64-apple-ios

# 2. Generate a C header from the FFI surface.
HEADER_DIR="ios-include"
rm -rf "$HEADER_DIR"
mkdir -p "$HEADER_DIR"
cbindgen --config cbindgen.toml --crate torah_search --output "$HEADER_DIR/tantivy_bridge.h"

# 3. Lipo the simulator slices into one fat archive (xcframework wants a
#    single file per platform "slice", not multiple per arch on the same SDK).
mkdir -p target/sim-universal
lipo -create \
  target/aarch64-apple-ios-sim/release/libtorah_search.a \
  target/x86_64-apple-ios/release/libtorah_search.a \
  -output target/sim-universal/libtorah_search.a

# 4. Bundle into an xcframework.
XCF_OUT="../ios/TorahSearch/TorahSearch.xcframework"
rm -rf "$XCF_OUT"
mkdir -p "$(dirname "$XCF_OUT")"
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libtorah_search.a \
    -headers "$HEADER_DIR" \
  -library target/sim-universal/libtorah_search.a \
    -headers "$HEADER_DIR" \
  -output "$XCF_OUT"

echo
echo "xcframework written to: $XCF_OUT"
