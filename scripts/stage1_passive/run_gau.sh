#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

DOMAIN="$1"

check_tool gau
log_info "gau starting on $DOMAIN"

gau "$DOMAIN" 2>&1 | while IFS= read -r line; do
    if [[ -n "$line" ]]; then
        emit_json "{\"url\": \"$line\", \"source\": \"gau\"}"
    fi
done

log_info "gau complete on $DOMAIN"
