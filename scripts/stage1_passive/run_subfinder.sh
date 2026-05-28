#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

DOMAIN="$1"
OUTPUT_DIR="$2"
THREADS="${3:-10}"

check_tool subfinder
log_info "subfinder starting on $DOMAIN"

subfinder -d "$DOMAIN" -silent -json -t "$THREADS" \
    2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null 2>&1; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done

log_info "subfinder complete on $DOMAIN"
