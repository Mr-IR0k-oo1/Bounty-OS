#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

HOSTS_FILE="$1"
OUTPUT_DIR="$2"

check_tool nmap
COUNT=$(wc -l < "$HOSTS_FILE")
log_info "nmap scanning $COUNT hosts"

mkdir -p "$OUTPUT_DIR"
nmap -iL "$HOSTS_FILE" -oX "$OUTPUT_DIR/nmap.xml" -v 2>&1 | while IFS= read -r line; do
    log_info "$line"
done

if [[ -f "$OUTPUT_DIR/nmap.xml" ]]; then
    python3 -c "
import xml.etree.ElementTree as ET
import json, sys

tree = ET.parse('$OUTPUT_DIR/nmap.xml')
root = tree.getroot()
for host in root.findall('host'):
    addr = host.find('address')
    if addr is not None:
        ip = addr.get('addr', '')
        hostnames = host.find('hostnames')
        hostname = ''
        if hostnames is not None:
            hn = hostnames.find('hostname')
            if hn is not None:
                hostname = hn.get('name', '')
        ports = host.find('ports')
        port_list = []
        if ports is not None:
            for port in ports.findall('port'):
                portid = port.get('portid')
                protocol = port.get('protocol')
                state = port.find('state')
                service = port.find('service')
                port_list.append({
                    'port': portid,
                    'protocol': protocol,
                    'state': state.get('state', '') if state is not None else '',
                    'service': service.get('name', '') if service is not None else ''
                })
        print(json.dumps({'host': ip, 'hostname': hostname, 'ports': port_list}))
" 2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done
fi

log_info "nmap complete"
