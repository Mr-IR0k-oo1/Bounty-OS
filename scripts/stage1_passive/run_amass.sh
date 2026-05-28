#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

DOMAIN="$1"
OUTPUT_DIR="$2"

check_tool amass
log_info "amass enum starting on $DOMAIN"

amass enum -d "$DOMAIN" -json -o "$OUTPUT_DIR/amass.json" 2>&1

if [[ -f "$OUTPUT_DIR/amass.json" ]]; then
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            emit_json "$line"
        fi
    done < "$OUTPUT_DIR/amass.json"
fi

log_info "amass complete on $DOMAIN"
