#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

TARGET_URL="$1"
OUTPUT_DIR="$2"
CUSTOM_PAYLOADS="${3:-/app/wordlists/param-names.txt}"

check_tool dalfox

log_info "dalfox XSS scan starting on $TARGET_URL"

dalfox url "$TARGET_URL" --format json --silence --skip-bav --only-poc r \
    2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null 2>&1; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done

log_info "dalfox scan complete on $TARGET_URL"
