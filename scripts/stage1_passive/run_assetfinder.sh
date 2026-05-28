#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

DOMAIN="$1"

check_tool assetfinder
log_info "assetfinder starting on $DOMAIN"

assetfinder --subs-only "$DOMAIN" | while IFS= read -r line; do
    if [[ -n "$line" ]]; then
        emit_json "{\"host\": \"$line\", \"source\": \"assetfinder\"}"
    fi
done

log_info "assetfinder complete on $DOMAIN"
