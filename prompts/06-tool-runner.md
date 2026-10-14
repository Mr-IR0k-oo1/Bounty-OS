# Bounty OS — Stage 06: Security Tool Runner

Implement the controlled tool execution layer.

## Initial tools
subfinder, dnsx, httpx, naabu, nmap, katana, gau, waybackurls, ffuf, nuclei.

Do not assume every tool is installed.

## Requirements
Create a common typed tool execution interface. A tool request must identify the tool, target, program, scope, options, and job.

Before execution:
1. validate request
2. validate scope
3. validate policy
4. enforce timeout
5. enforce resource constraints where possible
6. capture stdout/stderr
7. record exit status
8. record execution metadata

Never execute arbitrary model-generated shell strings. Construct arguments from structured data.

Start with one real adapter fully functional and tested. Other adapters may have clearly defined interfaces if binaries are unavailable. Never fake successful execution.

## Tests
Test command construction without external binaries and rejection of out-of-scope targets, malformed targets, and invalid arguments.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: add controlled security tool runner"
```
Do not continue until the commit succeeds.
