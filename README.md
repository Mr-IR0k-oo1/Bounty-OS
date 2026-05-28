# BountyOS v3.0

Bug bounty program management platform. Rust backend + Next.js frontend + Bash tool orchestration.

## Architecture

- **Backend**: Rust (Axum 0.7) with PostgreSQL + Redis
- **Frontend**: Next.js 14 App Router, Tailwind CSS, shadcn/ui
- **Tooling**: Bash scripts per tool, orchestrated by Rust pipeline runner
- **Infrastructure**: Docker Compose, fully local

## Quick Start

```bash
cp .env.example .env
# Edit .env with secure passwords
make setup
docker-compose up -d
```

Visit https://localhost and complete the setup wizard.

## CLI

```bash
bountyos login --server https://localhost
bountyos project list
bountyos scan --program uber --stage 1
```

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `crates/bountyos-api/` | Axum web server |
| `crates/bountyos-cli/` | CLI binary |
| `crates/bountyos-common/` | Shared types |
| `frontend/` | Next.js 14 |
| `scripts/` | Bash tool scripts |
| `config/` | Server configuration |
| `nginx/` | Reverse proxy config |
| `evidence/` | Tool output artifacts |
