#!/usr/bin/env bash
# Full Bauhaus suite. Pass a single test path to run just that one.
set -u
cd "$(dirname "$0")/.."
if [ $# -gt 0 ] && [ -f "$1" ]; then exec node "$@"; fi

fail=0
for t in tests/contrast.test.mjs tests/breakpoints.test.mjs tests/reveal.test.mjs \
         tests/bird-overlap.test.mjs tests/hero-locked.test.mjs \
         tests/regressions.test.mjs tests/bauhaus-check.mjs; do
  printf '\n=== %s ===\n' "$t"
  node "$t" "$@" || fail=1
done
printf '\n'
[ $fail -eq 0 ] && echo "SUITE PASS" || echo "SUITE FAIL"
exit $fail
