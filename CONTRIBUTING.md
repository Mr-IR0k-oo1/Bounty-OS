# Contributing to Bounty OS

Thank you for your interest in contributing to **Bounty OS**! We welcome community contributions, bug reports, documentation updates, and new tool adapters.

---

## 1. Development Prerequisites

- **Rust**: Stable 1.75+ (`rustup default stable`)
- **Node.js**: v20+ with npm
- **Docker & Docker Compose**: v2.20+
- **Security Tools**: Naabu, Subfinder, Katana, Nuclei, Dalfox, GAU, Waybackurls, FFuf (automatically bundled in Docker containers)

---

## 2. Local Development Setup

Clone the repository and spin up the complete local environment:

```bash
git clone https://github.com/Mr-IR0k-oo1/Bounty-OS.git
cd Bounty-OS

# Copy environment template
cp .env.example .env

# Build and start development containers
docker compose up -d --build
```

Services will be accessible at:
- **Web UI**: `http://localhost:3000`
- **REST API**: `http://localhost:8000`
- **MCP Server**: `http://localhost:3005` (SSE endpoint `/sse`)
- **PostgreSQL**: `localhost:5433`
- **Lab Target**: `http://localhost:8888`

---

## 3. Running Test Suites & Benchmarks

Before opening a pull request, ensure all test suites pass:

```bash
# Run Rust unit and integration tests
cargo test --workspace

# Run TypeScript / MCP build
cd mcp && npm run build && npm test

# Run autonomous lab verification suite
node scripts/prove_autonomous_investigation.js

# Run cross-investigation experience acceptance proof
node scripts/prove_cross_investigation_experience.js

# Run multi-strategy benchmark
node scripts/benchmark_v06_experience.js
```

---

## 4. Code Standards & Architecture Guidelines

1. **Rust Backend (`crates/`)**:
   - Format with `cargo fmt`.
   - Lint with `cargo clippy -- -D warnings`.
   - Keep models modular and use SQLx migrations for all schema modifications.
   - Maintain safety guarantees: no unsafe blocks without explicit documentation.
2. **Deterministic & Empirical Planner**:
   - Preserve Bayesian mathematical invariants in [`intelligence/experience.rs`](crates/bountyos-server/src/intelligence/experience.rs).
   - Ensure the minimum sample rule is honored ($n < 10 \implies$ no pruning allowed under any circumstances).
3. **Scope Protection**:
   - Any new tool adapter must integrate with the scope validation middleware before execution.

---

## 5. Pull Request Process

1. Fork the repository and create your feature branch from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat(intelligence): add active graphql introspection analyzer"
   ```
3. Push to your fork and submit a Pull Request targeting `main`.
4. Provide a clear summary of changes, benchmark numbers (if touching planner heuristics), and reproduction steps.
