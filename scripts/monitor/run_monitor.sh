#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

TARGET="$1"
PREVIOUS_SCAN="$2"
CURRENT_SCAN="$3"

log_info "monitor comparing $PREVIOUS_SCAN vs $CURRENT_SCAN for $TARGET"

if [[ ! -f "$PREVIOUS_SCAN" ]]; then
    log_warn "No previous scan found at $PREVIOUS_SCAN, emitting all as new"
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            emit_json "{\"change\":\"new\",\"host\":\"$line\",\"target\":\"$TARGET\"}"
        fi
    done < "$CURRENT_SCAN"
    log_info "monitor complete: no previous scan, all entries new"
    exit 0
fi

NEW_SUBS=$(comm -13 <(sort "$PREVIOUS_SCAN") <(sort "$CURRENT_SCAN"))
GONE_SUBS=$(comm -23 <(sort "$PREVIOUS_SCAN") <(sort "$CURRENT_SCAN"))

while IFS= read -r sub; do
    if [[ -n "$sub" ]]; then
        emit_json "{\"change\":\"new\",\"host\":\"$sub\",\"target\":\"$TARGET\"}"
    fi
done <<< "$NEW_SUBS"

while IFS= read -r sub; do
    if [[ -n "$sub" ]]; then
        emit_json "{\"change\":\"gone\",\"host\":\"$sub\",\"target\":\"$TARGET\"}"
    fi
done <<< "$GONE_SUBS"

log_info "monitor complete for $TARGET"
