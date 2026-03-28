#!/bin/bash
# Build script to generate Chrome and Firefox extension variants
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/dist"

# Clean
rm -rf "$DIST_DIR"

# Shared files
SHARED_FILES=(
  "background/service-worker.js"
  "background/sidebar-compat.js"
  "content/inspector.js"
  "content/highlight.js"
  "content/content.css"
  "sidepanel/sidepanel.html"
  "sidepanel/sidepanel.js"
  "sidepanel/sidepanel.css"
  "icons/icon-16.png"
  "icons/icon-48.png"
  "icons/icon-128.png"
)

build_variant() {
  local variant="$1"
  local manifest="$2"
  local out="$DIST_DIR/$variant"

  echo "Building $variant..."
  mkdir -p "$out"

  # Copy manifest
  cp "$ROOT_DIR/$manifest" "$out/manifest.json"

  # Copy shared files
  for f in "${SHARED_FILES[@]}"; do
    mkdir -p "$out/$(dirname "$f")"
    cp "$ROOT_DIR/$f" "$out/$f"
  done

  # Copy polyfill
  if [ -f "$ROOT_DIR/node_modules/webextension-polyfill/dist/browser-polyfill.min.js" ]; then
    cp "$ROOT_DIR/node_modules/webextension-polyfill/dist/browser-polyfill.min.js" "$out/browser-polyfill.min.js"
  fi

  echo "  → $out"
}

build_variant "chrome" "manifest.json"
build_variant "firefox" "manifest.firefox.json"

echo "Done! Variants in $DIST_DIR/"
