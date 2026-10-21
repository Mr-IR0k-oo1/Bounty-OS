#!/bin/sh
urls="
https://github.com/projectdiscovery/subfinder/releases/download/v2.6.7/subfinder_2.6.7_linux_amd64.zip
https://github.com/projectdiscovery/dnsx/releases/download/v1.2.1/dnsx_1.2.1_linux_amd64.zip
https://github.com/projectdiscovery/naabu/releases/download/v2.3.1/naabu_2.3.1_linux_amd64.zip
https://github.com/projectdiscovery/httpx/releases/download/v1.6.8/httpx_1.6.8_linux_amd64.zip
https://github.com/lc/gau/releases/download/v2.2.3/gau_2.2.3_linux_amd64.tar.gz
https://github.com/tomnomnom/waybackurls/releases/download/v0.1.0/waybackurls-linux-amd64-0.1.0.tar.gz
https://github.com/projectdiscovery/katana/releases/download/v1.1.0/katana_1.1.0_linux_amd64.zip
https://github.com/projectdiscovery/nuclei/releases/download/v3.3.2/nuclei_3.3.2_linux_amd64.zip
https://github.com/ffuf/ffuf/releases/download/v2.1.0/ffuf_2.1.0_linux_amd64.tar.gz
https://github.com/hahwul/dalfox/releases/download/v2.9.2/dalfox_2.9.2_linux_amd64.tar.gz
"
for u in $urls; do
    code=$(curl -sIL -w '%{http_code}\n' -o /dev/null "$u" | tail -n 1)
    echo "$code $u"
done
