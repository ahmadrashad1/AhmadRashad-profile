/**
 * Spec p.22: the clay build ran eight breakpoints, three of them keyed to
 * viewport HEIGHT rather than width. They are load-bearing -- a locked
 * hero clips on a 1440x720 laptop without them -- and the restyle must
 * not quietly collapse them into a tidy width-only set.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const CSS_DIR = new URL("../css/", import.meta.url).pathname;

const REQUIRED = [
  "(min-width: 860px)",
  "(max-width: 1439px)",
  "(max-height: 760px)",
  "(max-width: 640px)",
  "(max-width: 600px)",
  "(min-height: 600px)",
  "(pointer: coarse)",
  "(prefers-reduced-motion: reduce)",
];

// styles.css is the retired clay build; counting it would green this test
// on breakpoints the new system never re-implemented.
const files = (await readdir(CSS_DIR)).filter(f => f.endsWith(".css") && f !== "styles.css");
const css = (await Promise.all(files.map(f => readFile(join(CSS_DIR, f), "utf8")))).join("\n");

let failed = 0;
for (const q of REQUIRED) {
  const found = css.includes(q);
  console.log(`${found ? "pass" : "FAIL"}  ${q}`);
  if (!found) failed++;
}
console.log(`\nstylesheets scanned: ${files.join(", ")}`);
console.log(failed === 0 ? `PASS — ${REQUIRED.length}/${REQUIRED.length} breakpoints present`
                         : `FAIL — ${failed} breakpoint(s) lost`);
process.exit(failed === 0 ? 0 : 1);
