#!/usr/bin/env bash
# ==============================================================================
# Bounty OS Home-Lab Setup & Validation Script
# Target: Ubuntu Server 24.04 / 22.04 LTS (Core i3, 8 GB RAM)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== Bounty OS Home-Lab Setup ==="
echo "Working directory: ${ROOT_DIR}"

# 1. Check directories for persistent storage
mkdir -p "${ROOT_DIR}/evidence" "${ROOT_DIR}/logs"
chmod 755 "${ROOT_DIR}/evidence" "${ROOT_DIR}/logs"
echo "Persistent storage directories initialized: ./evidence, ./logs"

# 2. Check/Generate .env file
if [ ! -f "${ROOT_DIR}/.env" ]; then
    echo "Creating .env from .env.example with secure random secrets..."
    cp "${ROOT_DIR}/.env.example" "${ROOT_DIR}/.env"
    
    # Generate random passwords & secrets
    DB_PASS=$(openssl rand -hex 16)
    REDIS_PASS=$(openssl rand -hex 16)
    JWT_SEC=$(openssl rand -hex 32)
    
    sed -i "s/replace_with_secure_postgres_password/${DB_PASS}/" "${ROOT_DIR}/.env"
    sed -i "s/replace_with_secure_redis_password/${REDIS_PASS}/" "${ROOT_DIR}/.env"
    sed -i "s/replace_with_random_32_byte_secret_minimum/${JWT_SEC}/" "${ROOT_DIR}/.env"
    
    echo "Generated new secure secrets in .env (mode 600)"
    chmod 600 "${ROOT_DIR}/.env"
else
    echo "Existing .env found. Keeping current secrets."
fi

# 3. Check memory and system requirements
if [ -f /proc/meminfo ]; then
    MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEM_TOTAL_GB=$((MEM_TOTAL_KB / 1024 / 1024))
    echo "Detected System RAM: ~${MEM_TOTAL_GB} GB"
    if [ "${MEM_TOTAL_GB}" -lt 7 ]; then
        echo "WARNING: Less than 8 GB RAM detected. Ensure container memory limits are enforced."
    fi
fi

# 4. Validate Docker and Compose availability
if command -v docker >/dev/null 2>&1; then
    echo "Docker is installed: $(docker --version)"
    if docker compose version >/dev/null 2>&1; then
        echo "Docker Compose is installed: $(docker compose version)"
        echo "Validating docker compose configuration..."
        docker compose -f "${ROOT_DIR}/docker-compose.yml" --env-file "${ROOT_DIR}/.env" config >/dev/null
        echo "Docker Compose syntax and configuration are VALID."
    else
        echo "WARNING: docker compose plugin not found."
    fi
else
    echo "WARNING: Docker is not installed. To install Docker on Ubuntu Server:"
    echo "  curl -fsSL https://get.docker.com | sh"
fi

echo "=== Setup complete ==="
echo "To start services:"
echo "  docker compose up -d"
echo ""
echo "To check health:"
echo "  docker compose ps"
echo "  curl -f http://127.0.0.1:8000/health"
echo ""
echo "To stop services:"
echo "  docker compose down"
