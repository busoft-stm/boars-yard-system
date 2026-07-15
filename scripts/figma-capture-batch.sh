#!/bin/bash
# Batch-open Smart Yard routes for Figma html-to-design capture.
# Usage: ./scripts/figma-capture-batch.sh <capture_id> <path>
# Example: ./scripts/figma-capture-batch.sh 735dbe48-f2b1-42b2-b002-aaf089735538 /

set -euo pipefail
export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"

CAPTURE_ID="${1:?capture id required}"
PATH_PART="${2:?route path required}"
BASE="${FIGMA_CAPTURE_BASE:-http://127.0.0.1:5173}"
DELAY="${FIGMA_CAPTURE_DELAY:-7000}"

EP=$(/usr/bin/python3 -c "import urllib.parse; print(urllib.parse.quote('https://mcp.figma.com/mcp/capture/${CAPTURE_ID}/submit', safe=''))")
URL="${BASE}${PATH_PART}#figmacapture=${CAPTURE_ID}&figmaendpoint=${EP}&figmadelay=${DELAY}"

/usr/bin/open "$URL"
echo "Opened: ${PATH_PART} (${CAPTURE_ID})"
