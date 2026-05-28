#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

HOSTS_FILE="$1"

check_tool naabu
COUNT=$(wc -l < "$HOSTS_FILE")
log_info "naabu scanning $COUNT hosts"

naabu -list "$HOSTS_FILE" -silent -json 2>&1 | while IFS= read -r line; do
    if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        emit_json "$line"
    else
        log_info "$line"
    fi
done

log_info "naabu complete"
