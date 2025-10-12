#!/usr/bin/env bash

# Download data CSVs using curl (follows redirects) and validate results.
# Usage: Ensure environment variables are set to the target CSV URLs, then run:
#   bash ingest/update-data.sh
#
# Required env vars (any missing will be skipped):
#   LAWRENCEVILLE_DRAFT, LAWRENCEVILLE_CANS, LAWRENCEVILLE_FOOD,
#   LAWRENCEVILLE_EVENTS, LAWRENCEVILLE_HOURS,
#   ZELIENOPLE_DRAFT, ZELIENOPLE_CANS, ZELIENOPLE_FOOD,
#   ZELIENOPLE_EVENTS, ZELIENOPLE_HOURS,
#   BEER, COMING

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$REPO_ROOT/_data"

mkdir -p "$DATA_DIR"
cd "$DATA_DIR" || exit 1

# Default curl options: follow redirects, fail on HTTP errors, retry, timeout, UA/header
CURL_OPTS=(
  --location
  --fail
  --retry 3
  --retry-delay 2
  --max-time 30
  --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  --header "Accept: text/csv,*/*"
  --show-error
  --silent
)

download_csv() {
  local filename="$1"
  local url="$2"

  if [[ -z "$url" ]]; then
    echo "SKIP: URL not provided for $filename"
    return 1
  fi

  echo "Downloading $filename ..."
  if ! curl "${CURL_OPTS[@]}" -o "$filename" "$url"; then
    echo "ERROR: curl failed for $filename"
    rm -f "$filename" 2>/dev/null || true
    return 1
  fi

  # Detect Google Sheets/HTML error pages
  if grep -q "<!DOCTYPE html>" "$filename" 2>/dev/null; then
    echo "ERROR: $filename contains HTML error page, removing..."
    rm -f "$filename" 2>/dev/null || true
    return 1
  fi

  # Ensure non-empty
  if [[ ! -s "$filename" ]]; then
    echo "ERROR: $filename is empty, removing..."
    rm -f "$filename" 2>/dev/null || true
    return 1
  fi

  echo "SUCCESS: $filename downloaded"
  return 0
}

# Lawrenceville
download_csv "lawrenceville-draft.csv"  "${LAWRENCEVILLE_DRAFT:-}"
download_csv "lawrenceville-cans.csv"   "${LAWRENCEVILLE_CANS:-}"
download_csv "lawrenceville-food.csv"   "${LAWRENCEVILLE_FOOD:-}"
download_csv "lawrenceville-events.csv" "${LAWRENCEVILLE_EVENTS:-}"
download_csv "lawrenceville-hours.csv"  "${LAWRENCEVILLE_HOURS:-}"

# Zelienople
download_csv "zelienople-draft.csv"  "${ZELIENOPLE_DRAFT:-}"
download_csv "zelienople-cans.csv"   "${ZELIENOPLE_CANS:-}"
download_csv "zelienople-food.csv"   "${ZELIENOPLE_FOOD:-}"
download_csv "zelienople-events.csv" "${ZELIENOPLE_EVENTS:-}"
download_csv "zelienople-hours.csv"  "${ZELIENOPLE_HOURS:-}"

# Shared
download_csv "beer.csv"   "${BEER:-}"
download_csv "coming.csv" "${COMING:-}"

echo "Done. Files stored in $DATA_DIR"




