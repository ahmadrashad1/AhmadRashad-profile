/**
 * Contrast helper tests.
 *
 * Spec p.05 states red on paper is 3.4:1 — large text and headings only,
 * never a paragraph. Spec p.23 restates it as a cost of going flat. The
 * conformance check needs a contrast function that actually catches it,
 * so this pins the two cases that matter before the check consumes it.
 *
 * Usage: node tests/contrast.test.mjs
 */

import { contrastRatio } from "./contrast.mjs";

const PAPER = "rgb(239, 231, 215)";
const RED = "rgb(206, 68, 53)";
const INK = "rgb(21, 22, 26)";
const INK_SOFT = "rgb(90, 86, 78)";
const BLUE = "rgb(30, 79, 161)";
const WHITE = "rgb(255, 255, 255)";

let failed = 0;
const check = (name, actual, predicate, expectation) => {
  const ok = predicate(actual);
  console.log(`${ok ? "pass" : "FAIL"}  ${name} → ${actual.toFixed(2)}  (${expectation})`);
  if (!ok) failed++;
};

// The case the spec warns about: red body text on paper fails AA.
check("red on paper", contrastRatio(RED, PAPER), (r) => r < 4.5, "measured 3.79:1 — body text forbidden");

// The values the spec publishes on p.05 must hold.
check("ink on paper", contrastRatio(INK, PAPER), (r) => r > 14.5 && r < 15, "measured 14.71:1");
check("ink-soft on paper", contrastRatio(INK_SOFT, PAPER), (r) => r > 5.5 && r < 6.5, "measured 5.94:1, AA for small text");
check("white on blue", contrastRatio(WHITE, BLUE), (r) => r > 7.5 && r < 8.5, "measured 7.81:1");
check("white on red", contrastRatio(WHITE, RED), (r) => r >= 4.5 && r < 5, "measured 4.66:1, AA for button labels");

// Order must not matter.
check("symmetry", Math.abs(contrastRatio(INK, PAPER) - contrastRatio(PAPER, INK)), (d) => d < 0.001, "ratio is symmetric");

console.log(failed === 0 ? `\nPASS — 6/6` : `\nFAIL — ${failed}/6 failing`);
process.exit(failed === 0 ? 0 : 1);
