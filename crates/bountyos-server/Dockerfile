FROM rust:latest AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY migrations/ migrations/
COPY crates/ crates/
RUN cargo build --release --bin bountyos-server --jobs 2

# Tool builder stage for gau, waybackurls, ffuf
FROM golang:alpine AS tool-builder
RUN CGO_ENABLED=0 go install github.com/lc/gau/v2/cmd/gau@latest \
    && CGO_ENABLED=0 go install github.com/tomnomnom/waybackurls@latest \
    && CGO_ENABLED=0 go install github.com/ffuf/ffuf/v2@latest

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates curl python3 bash libpcap0.8 musl libpq5 \
    && ln -s /usr/lib/x86_64-linux-musl/libc.so /usr/lib/libc.musl-x86_64.so.1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy server binary
COPY --from=builder /app/target/release/bountyos-server /usr/local/bin/

# Copy ProjectDiscovery tools
COPY --from=projectdiscovery/subfinder:latest /usr/local/bin/subfinder /usr/local/bin/subfinder
COPY --from=projectdiscovery/dnsx:latest /usr/local/bin/dnsx /usr/local/bin/dnsx
COPY --from=projectdiscovery/naabu:latest /usr/local/bin/naabu /usr/local/bin/naabu
COPY --from=projectdiscovery/httpx:latest /usr/local/bin/httpx /usr/local/bin/httpx
COPY --from=projectdiscovery/katana:latest /usr/local/bin/katana /usr/local/bin/katana
COPY --from=projectdiscovery/nuclei:latest /usr/local/bin/nuclei /usr/local/bin/nuclei

# Copy Dalfox
COPY --from=hahwul/dalfox:latest /app/dalfox /usr/local/bin/dalfox

# Copy gau, waybackurls, ffuf
COPY --from=tool-builder /go/bin/gau /usr/local/bin/gau
COPY --from=tool-builder /go/bin/waybackurls /usr/local/bin/waybackurls
COPY --from=tool-builder /go/bin/ffuf /usr/local/bin/ffuf

RUN chmod +x /usr/local/bin/*

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["bountyos-server"]
