#!/usr/bin/env sh
set -eu
: "${TIDELIGHT_API_KEY:?Set TIDELIGHT_API_KEY in your shell first}"
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${TIDELIGHT_API_KEY}" \
  -H 'Accept: application/json' \
  'https://api.tidelight.app/v1/market/instruments?kind=rtoken&limit=10'
