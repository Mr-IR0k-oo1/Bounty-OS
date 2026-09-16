#!/usr/bin/env bash
# llm_check.sh — Verify Ollama is running and the configured model is available.
# Used by BountyOS Settings → Tools health check.
#
# Usage: bash scripts/lib/llm_check.sh [MODEL_NAME] [OLLAMA_URL]
#   MODEL_NAME   default: vulnllm-r-7b
#   OLLAMA_URL   default: http://localhost:11434

set -euo pipefail

MODEL="${1:-vulnllm-r-7b}"
OLLAMA_URL="${2:-http://localhost:11434}"

check_tool() {
    if ! command -v "$1" &>/dev/null; then
        echo "[ERROR] Required tool not found: $1" >&2
        exit 2
    fi
}

check_tool curl
check_tool jq

echo "[INFO]  Checking Ollama at ${OLLAMA_URL}" >&2

# 1. Reachability
HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${OLLAMA_URL}/api/tags" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" != "200" ]]; then
    echo "[ERROR] Ollama not reachable at ${OLLAMA_URL} (HTTP ${HTTP_STATUS})" >&2
    echo "{\"status\": \"error\", \"message\": \"Ollama not reachable\", \"url\": \"${OLLAMA_URL}\"}"
    exit 1
fi

echo "[INFO]  Ollama reachable — checking for model: ${MODEL}" >&2

# 2. Check if the model is present in the list
MODELS_JSON=$(curl -sf "${OLLAMA_URL}/api/tags")
MODEL_FOUND=$(echo "$MODELS_JSON" | jq -r --arg m "$MODEL" \
    '.models[]? | select(.name | startswith($m)) | .name' 2>/dev/null | head -1)

if [[ -z "$MODEL_FOUND" ]]; then
    echo "[WARN]  Model '${MODEL}' not found in Ollama. Run: ollama pull ${MODEL}" >&2
    echo "{\"status\": \"missing_model\", \"model\": \"${MODEL}\", \"url\": \"${OLLAMA_URL}\"}"
    exit 1
fi

echo "[INFO]  Model found: ${MODEL_FOUND}" >&2

# 3. Emit JSON result for Rust parser
echo "{\"status\": \"ok\", \"model\": \"${MODEL_FOUND}\", \"url\": \"${OLLAMA_URL}\"}"
