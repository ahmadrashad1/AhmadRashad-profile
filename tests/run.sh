#!/usr/bin/env bash
# Bauhaus conformance check. Pass --only=<rule> to isolate one assertion.
set -u
cd "$(dirname "$0")/.."
exec node tests/bauhaus-check.mjs "$@"
