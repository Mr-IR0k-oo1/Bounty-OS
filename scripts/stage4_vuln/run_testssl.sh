#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

HOST="$1"
OUTPUT_DIR="$2"

check_tool testssl
log_info "testssl scanning $HOST"

mkdir -p "$OUTPUT_DIR"
testssl --jsonfile "$OUTPUT_DIR/testssl.json" "$HOST" 2>&1 | while IFS= read -r line; do
    log_info "$line"
done

if [[ -f "$OUTPUT_DIR/testssl.json" ]]; then
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            emit_json "$line"
        fi
    done < "$OUTPUT_DIR/testssl.json"
fi

log_info "testssl complete"
