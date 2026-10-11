#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT/production/rebuilt}"
mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
CLIPS="$ROOT/production/clips"
ffmpeg -y -hide_banner -loglevel error \
  -i "$CLIPS/intro.mp4" -i "$CLIPS/main_tide_restored.mp4" -i "$CLIPS/outro_full.mp4" \
  -filter_complex "[0:v]settb=AVTB,setpts=PTS-STARTPTS,fps=60,format=yuv420p[v0];[1:v]settb=AVTB,setpts=PTS-STARTPTS,fps=60,format=yuv420p[v1];[2:v]settb=AVTB,setpts=PTS-STARTPTS,fps=60,format=yuv420p[v2];[v0][v1]xfade=transition=fade:duration=1:offset=9[v01];[v01][v2]xfade=transition=fade:duration=1:offset=219.466667,ass='$ROOT/deliverables/captions.ass'[v]" \
  -map '[v]' -an -t 233.874 -r 60 -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -movflags +faststart "$TMP/final-picture.mp4"
bash "$ROOT/production/scripts/mix_audio.sh" "$TMP/mix_stereo.m4a"
ffmpeg -y -hide_banner -loglevel error \
  -i "$TMP/final-picture.mp4" -i "$TMP/mix_stereo.m4a" \
  -map 0:v -map 1:a -t 233.866667 -c:v copy -c:a copy -movflags +faststart \
  "$OUT_DIR/Tidelight_Hackathon_Cinematic_Demo_1080p.mp4"
printf 'Wrote %s\n' "$OUT_DIR/Tidelight_Hackathon_Cinematic_Demo_1080p.mp4"
