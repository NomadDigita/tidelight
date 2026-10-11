#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-$ROOT/production/rebuilt/mix_stereo.m4a}"
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -hide_banner -loglevel error \
  -i "$ROOT/assets/audio/narration.mp3" -i "$ROOT/assets/audio/ambient-score.wav" \
  -filter_complex "[1:a]volume=0.21[music];[0:a]pan=stereo|c0=c0|c1=c0[voice];[music][voice]sidechaincompress=threshold=0.03:ratio=8:attack=120:release=900[duck];[voice][duck]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=10,afade=t=out:st=231.87:d=2[a]" \
  -map '[a]' -t 233.874 -c:a aac -b:a 192k -ar 48000 -ac 2 "$OUT"
