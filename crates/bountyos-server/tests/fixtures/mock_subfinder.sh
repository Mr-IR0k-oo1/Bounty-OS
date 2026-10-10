#!/usr/bin/env bash
# Mock Subfinder CLI for test suite
# Mimics ProjectDiscovery subfinder behavior without making external network calls

if [ "$1" = "-version" ]; then
    echo "subfinder v2.6.7"
    exit 0
fi

# Parse arguments
TARGET=""
for arg in "$@"; do
    if [ "$PREV" = "-d" ]; then
        TARGET="$arg"
    fi
    PREV="$arg"
done

# Handle test scenarios
if [ "$TARGET" = "error.test" ]; then
    echo "FATAL: network unreachable" >&2
    exit 1
fi

if [ "$TARGET" = "timeout.test" ]; then
    sleep 10
    exit 0
fi

if [ "$TARGET" = "zero.test" ]; then
    # Clean zero results
    exit 0
fi

# Default output for test domains
if [ -n "$TARGET" ]; then
    echo "api.${TARGET}"
    echo "auth.${TARGET}"
    echo "www.${TARGET}"
    echo "api.${TARGET}"  # Duplicate to test deduplication
    echo "blog.${TARGET}." # Trailing dot to test normalization
    echo "DEV.${TARGET}"   # Uppercase to test lowercasing
    exit 0
fi

echo "No target specified" >&2
exit 1
