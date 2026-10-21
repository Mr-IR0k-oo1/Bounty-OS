#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

TOKEN="$1"
OUTPUT_DIR="${2:-}"

log_info "JWT token audit starting"

python3 "$(dirname "$0")/../tools/jwt_scanner.py" "$TOKEN" --json \
    2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null 2>&1; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done

log_info "JWT audit complete"
