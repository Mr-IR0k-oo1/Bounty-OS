#!/usr/bin/env bash
set -euo pipefail

log_info()   { echo "[INFO]  $(date -u +%H:%M:%S) $*" >&2; }
log_warn()   { echo "[WARN]  $(date -u +%H:%M:%S) $*" >&2; }
log_error()  { echo "[ERROR] $(date -u +%H:%M:%S) $*" >&2; }

check_tool() {
    if ! command -v "$1" &>/dev/null; then
        log_error "Required tool not found: $1"
        exit 2
    fi
    log_info "$1 found at $(command -v "$1")"
}

emit_json() { echo "$1"; }

validate_json() {
    echo "$1" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null
}
