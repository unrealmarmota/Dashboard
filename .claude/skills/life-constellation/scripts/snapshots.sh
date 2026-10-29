#!/usr/bin/env bash
# Snapshot every event in events.json (HyperFrames also writes contact sheets).
# Usage: snapshots.sh <project-dir> [out-dir]
set -euo pipefail
DIR="$(cd "${1:?usage: snapshots.sh <project-dir> [out-dir]}" && pwd)"
OUT="${2:-$DIR/snapshots}"
TIMES=$(node -e 'console.log(require(process.argv[1]).events.map(x=>x.t).join(","))' "$DIR/events.json")
(cd "$DIR" && npx --yes hyperframes snapshot --at "$TIMES" --no-end --output "$OUT" >/dev/null)
# frame-NN-at-Xs.png → event, in index.tsv
node -e '
const fs=require("fs"),path=require("path");const [ev,out]=process.argv.slice(1);
const e=require(ev).events;const files=fs.readdirSync(out).filter(f=>/^frame-.*\.png$/.test(f)).sort();
fs.writeFileSync(path.join(out,"index.tsv"),files.map((f,i)=>`${f}\t${e[i]?e[i].t+" s  "+e[i].what:""}`).join("\n")+"\n");' "$DIR/events.json" "$OUT"
ls "$OUT"/contact-sheet-*.jpg
