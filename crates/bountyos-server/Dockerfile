FROM rust:latest AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN cargo build --release --bin bountyos-server --jobs 2

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates curl python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/bountyos-server /usr/local/bin/
EXPOSE 8000
CMD ["bountyos-server"]
