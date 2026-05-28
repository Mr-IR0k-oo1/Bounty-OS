#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

SUBDOMAIN_LIST="$1"

check_tool subjack
COUNT=$(wc -l < "$SUBDOMAIN_LIST")
log_info "subjack checking $COUNT subdomains for takeover"

subjack -w "$SUBDOMAIN_LIST" -t 100 -timeout 30 -o /dev/stdout -ssl 2>&1 | while IFS= read -r line; do
    if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        emit_json "$line"
    else
        log_info "$line"
    fi
done

log_info "subjack complete"
