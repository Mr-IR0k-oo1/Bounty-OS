FROM rust:1.77-slim-bookworm AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY crates/bountyos-common crates/bountyos-common
COPY crates/bountyos-server crates/bountyos-server
RUN cargo build --release --bin bountyos-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/bountyos-server /usr/local/bin/
EXPOSE 8000
CMD ["bountyos-server"]
