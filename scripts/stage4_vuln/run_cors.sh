#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

URL_LIST="$1"
OUTPUT_DIR="$2"

log_info "CORS misconfiguration audit starting on $URL_LIST"

python3 "$(dirname "$0")/../tools/cors_scanner.py" -l "$URL_LIST" --json \
    2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null 2>&1; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done

log_info "CORS audit complete"
