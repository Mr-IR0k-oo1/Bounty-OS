#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

URL="$1"
OUTPUT_DIR="$2"

check_tool wpscan
log_info "wpscan scanning $URL"

wpscan --url "$URL" --format json 2>&1 | while IFS= read -r line; do
    if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        emit_json "$line"
    else
        log_info "$line"
    fi
done

log_info "wpscan complete"
