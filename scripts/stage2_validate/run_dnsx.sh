#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

HOSTS_LIST="$1"
OUTPUT_DIR="$2"
THREADS="${3:-25}"

check_tool dnsx

COUNT=$(wc -l < "$HOSTS_LIST" 2>/dev/null || echo "0")
log_info "dnsx resolving $COUNT hosts"

dnsx -l "$HOSTS_LIST" -a -aaaa -cname -resp -json -t "$THREADS" -silent \
    2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null 2>&1; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done

log_info "dnsx resolution complete"
