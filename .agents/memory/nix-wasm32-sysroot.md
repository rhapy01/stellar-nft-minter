---
name: NixOS wasm32 Rust compilation
description: How to compile Rust to wasm32-unknown-unknown on Replit's NixOS without rustup TLS failures.
---

## The Problem
The `rustup` stable toolchain downloaded via `rustup toolchain install stable` fails to run on NixOS with:
`librustc_driver-*.so: cannot allocate memory in static TLS block`
This is a fundamental NixOS incompatibility — patchelf and LD_PRELOAD do not fix it.

## The Solution
Use the NixOS-native Rust compiler (works fine) with a manually constructed wasm32 sysroot.

**Why:** The Nix `rust-mixed` package only ships x86_64; wasm32 stdlib must be fetched separately. The wasm32 stdlib archive is tiny (~20 MB) and compatible with the Nix rustc when placed in a custom sysroot.

**How to apply:**
```bash
# 1. Download wasm32 stdlib matching the Nix rustc version (check with: rustc --version)
curl -L "https://static.rust-lang.org/dist/2025-06-26/rust-std-1.88.0-wasm32-unknown-unknown.tar.xz" -o /tmp/rust-std-wasm32.tar.xz
mkdir -p /tmp/rust-std-wasm32 && tar xf /tmp/rust-std-wasm32.tar.xz -C /tmp/rust-std-wasm32 --strip-components=1

# 2. Build custom sysroot: symlink Nix rustlib + copy wasm32 stdlib
NIX_SYSROOT="/nix/store/brzjqpcbk04hzmhsqlmp7vng4jdis2yc-rust-mixed"
mkdir -p /tmp/nix-wasm32-sysroot/lib/rustlib
for item in "$NIX_SYSROOT/lib/rustlib/"*; do ln -sfn "$item" "/tmp/nix-wasm32-sysroot/lib/rustlib/$(basename $item)"; done
cp -r /tmp/rust-std-wasm32/rust-std-wasm32-unknown-unknown/lib/rustlib/wasm32-unknown-unknown /tmp/nix-wasm32-sysroot/lib/rustlib/

# 3. Compile using Nix cargo + custom sysroot
export RUSTFLAGS="--sysroot /tmp/nix-wasm32-sysroot"
export RUSTC="/nix/store/brzjqpcbk04hzmhsqlmp7vng4jdis2yc-rust-mixed/bin/rustc"
NIX_CARGO="/nix/store/brzjqpcbk04hzmhsqlmp7vng4jdis2yc-rust-mixed/bin/cargo"
"$NIX_CARGO" build --target wasm32-unknown-unknown --release
```

Note: The dist date in the URL (2025-06-26) matches the Nix package path `rustc-stable-2025-06-26`. If the Nix Rust version changes, find the new date with `rustc --version` and look up the matching dist date.
