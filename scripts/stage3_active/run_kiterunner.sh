#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

URL="$1"
WORDLIST="$2"

check_tool kr
log_info "kiterunner scanning $URL"

kr scan "$URL" -w "$WORDLIST" -json 2>&1 | while IFS= read -r line; do
    if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        emit_json "$line"
    else
        log_info "$line"
    fi
done

log_info "kiterunner complete"
