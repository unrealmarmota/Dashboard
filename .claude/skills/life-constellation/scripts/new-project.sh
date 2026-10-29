#!/usr/bin/env bash
# Scaffold a HyperFrames project for a life constellation and copy the template in.
# Usage: new-project.sh <folder> [cast.js]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: new-project.sh <folder> [cast.js]}"
CAST="${2:-}"
if [ ! -f "$DIR/hyperframes.json" ]; then
  npx --yes hyperframes init "$DIR" --example blank --resolution portrait --non-interactive --skip-skills >/dev/null
fi
cp "$HERE/template/index.html" "$HERE/template/sky.js" "$DIR/"
mkdir -p "$DIR/fonts" && cp "$HERE/template/fonts/"* "$DIR/fonts/"
if [ -n "$CAST" ]; then cp "$CAST" "$DIR/cast.js"
elif [ ! -f "$DIR/cast.js" ]; then cp "$HERE/template/cast.js" "$DIR/cast.js"; fi
node "$HERE/scripts/clock.mjs" "$DIR"
