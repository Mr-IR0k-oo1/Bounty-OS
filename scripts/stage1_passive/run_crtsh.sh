#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

DOMAIN="$1"

log_info "crtsh querying certificate logs for $DOMAIN"

curl -s "https://crt.sh/?q=%25.$DOMAIN&output=json" \
    | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    subs = set()
    for entry in data:
        name = entry.get('name_value', '')
        for sub in name.split('\n'):
            sub = sub.strip()
            if sub:
                subs.add(sub)
    for s in sorted(subs):
        print(json.dumps({'host': s, 'source': 'crtsh'}))
except Exception as e:
    json.dump({'error': str(e)}, sys.stderr)
    sys.exit(1)
" 2>&1 | while IFS= read -r line; do
    if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        emit_json "$line"
    else
        log_info "$line"
    fi
done

log_info "crtsh complete for $DOMAIN"
