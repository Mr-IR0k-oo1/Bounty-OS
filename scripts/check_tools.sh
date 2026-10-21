#!/bin/sh
for t in subfinder dnsx naabu httpx gau waybackurls katana nuclei ffuf dalfox; do
    printf "%-15s " "$t"
    command -v "$t" || echo "MISSING"
done
