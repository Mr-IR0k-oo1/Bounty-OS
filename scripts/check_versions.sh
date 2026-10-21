#!/bin/sh
for t in subfinder dnsx naabu httpx gau waybackurls katana nuclei ffuf dalfox; do
    echo "===== $t ====="
    case "$t" in
        ffuf) ffuf -V 2>&1 | head -n 2 ;;
        dalfox) dalfox --version 2>&1 | head -n 2 ;;
        gau) gau --version 2>&1 | head -n 2 ;;
        waybackurls) waybackurls -h 2>&1 | head -n 2 ;;
        *) "$t" -version 2>&1 | grep -i version || "$t" -version 2>&1 | head -n 2 ;;
    esac
done
