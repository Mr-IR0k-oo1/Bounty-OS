#!/usr/bin/env bash
set -euo pipefail

emit_result() {
    local tool="$1"
    local status="$2"
    local data="${3:-{}}"
    echo "{\"tool\":\"$tool\",\"status\":\"$status\",\"data\":$data}"
}

emit_finding() {
    local template_id="$1"
    local host="$2"
    local severity="$3"
    local extra="${4:-{}}"
    echo "{\"template-id\":\"$template_id\",\"host\":\"$host\",\"severity\":\"$severity\",$extra"
}
