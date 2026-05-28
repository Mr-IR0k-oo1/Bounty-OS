#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

URL_LIST="$1"
OUTPUT_DIR="$2"
TEMPLATES_DIR="${3:-$HOME/nuclei-templates}"
SEVERITY="${4:-critical,high,medium,low,info}"

check_tool nuclei

COUNT=$(wc -l < "$URL_LIST")
log_info "nuclei scanning $COUNT targets with severity: $SEVERITY"

nuclei -l "$URL_LIST" -t "$TEMPLATES_DIR" -severity "$SEVERITY" \
    -tags cve,rce,sqli,xss,lfi,ssrf,xxe,idor,exposure,misconfig,default-login,takeover \
    -jsonl -silent \
    2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'template-id' in d" 2>/dev/null; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done

log_info "nuclei complete"
