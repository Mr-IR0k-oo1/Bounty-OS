#!/usr/bin/env bash
set -u

PROMPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$PROMPT_DIR/.." && pwd)"

cd "$REPO_DIR" || exit 1

echo "========================================"
echo " BOUNTY OS OVERNIGHT BUILD"
echo "========================================"
echo "Repository: $REPO_DIR"
echo "Prompts:    $PROMPT_DIR"

for prompt in "$PROMPT_DIR"/[0-9][0-9]-*.md; do
    echo
    echo "========================================"
    echo "Running: $(basename "$prompt")"
    echo "========================================"

    claude "$(cat "$prompt")"
    status=$?

    if [ "$status" -ne 0 ]; then
        echo "FAILED: $(basename "$prompt")"
        echo "Stopping. Fix this stage before continuing."
        exit "$status"
    fi

    echo "Completed: $(basename "$prompt")"
done

echo
echo "========================================"
echo " OVERNIGHT BUILD COMPLETE"
echo "========================================"

git status
git log --oneline -10
