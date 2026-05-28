#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

DOMAIN="$1"

check_tool waybackurls
log_info "waybackurls starting on $DOMAIN"

waybackurls "$DOMAIN" 2>&1 | while IFS= read -r line; do
    if [[ -n "$line" ]]; then
        emit_json "{\"url\": \"$line\", \"source\": \"wayback\"}"
    fi
done

log_info "waybackurls complete on $DOMAIN"
