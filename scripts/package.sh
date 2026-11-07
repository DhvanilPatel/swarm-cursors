#!/usr/bin/env bash
# Build the store upload zip: dist/swarm-rebuild-<version>.zip
# (manifest.json at the zip root, no repo-only files).
# The same zip works for the Chrome Web Store and for
# addons.mozilla.org: AMO's linter notes that background.service_worker
# is ignored on Firefox (that's the point of the dual background keys),
# and informational notes don't block signing.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/swarm-rebuild"
version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$src/manifest.json" | head -n 1)"
out="$root/dist/swarm-rebuild-$version.zip"

mkdir -p "$root/dist"
rm -f "$out"
(cd "$src" && zip -r -X -q "$out" manifest.json background.js swarm.js icons -x '*.DS_Store')
echo "Built $out"
unzip -l "$out"
