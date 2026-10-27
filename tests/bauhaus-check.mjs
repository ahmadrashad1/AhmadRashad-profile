/**
 * Bauhaus system conformance check.
 *
 * Implements the spec's own migration test (p.11): a correct migration leaves
 * no blurred shadow and no rounded corner anywhere in the product. The rest of
 * the assertions pin the Global Constraints from the implementation plan.
 *
 * Usage: node tests/bauhaus-check.mjs [--only=ruleName] [--verbose]
 * Exits non-zero on any violation; prints one line per violation as
 *   <page> <viewport> <selector> <rule> <actual>
 */

import { chromium } from "/home/ahmadrashad/.local/share/pnpm/global/5/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { contrastRatio } from "./contrast.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const PAGES = ["index.html", "work.html"];
const VIEWPORTS = [
  { w: 1440, h: 900, name: "desktop" },
  { w: 820, h: 1000, name: "tablet" },
  { w: 390, h: 844, name: "mobile" },
];

/* The eight palette values, spec p.05. Everything the browser computes must
   resolve to one of these (plus transparent, plus pure white/black for text
   sitting on a saturated fill, plus GitHub language colors on .lang-dot). */
const PALETTE = {
  "rgb(206, 68, 53)": "red",
  "rgb(30, 79, 161)": "blue",
  "rgb(233, 169, 47)": "yellow",
  "rgb(21, 22, 26)": "ink",
  "rgb(90, 86, 78)": "ink-soft",
  "rgb(239, 231, 215)": "paper",
  "rgb(247, 242, 231)": "paper-lift",
  "rgb(226, 215, 194)": "paper-deep",
  "rgb(255, 255, 255)": "white",
  "rgba(0, 0, 0, 0)": "transparent",
};

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".webm": "video/webm", ".mp4": "video/mp4",
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
        const file = join(ROOT, rel === "/" ? "index.html" : rel);
        res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/* ---- the assertions, run inside the page ---------------------------------- */

const IN_PAGE = (paletteKeys) => {
  const out = [];
  const sel = (el) => (el === document.documentElement ? ":root"
    : (el.tagName || "?").toLowerCase() + (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "")).slice(0, 54);
  const add = (rule, el, actual) => {
    out.push({ rule, selector: sel(el), actual: String(actual).slice(0, 72) });
  };

  const all = [document.documentElement, ...document.querySelectorAll("*")]
    .filter((el) => !["SCRIPT", "STYLE", "TEMPLATE", "HEAD", "META", "LINK", "TITLE"].includes(el.tagName));

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };

  for (const el of all) {
    const cs = getComputedStyle(el);

    // --- noBlurredShadow: every shadow's blur radius must be 0 (spec p.11)
    const sh = cs.boxShadow;
    if (sh && sh !== "none") {
      for (const layer of sh.split(/,(?![^(]*\))/)) {
        const lens = layer.match(/-?[\d.]+px/g) || [];
        if (lens.length >= 3 && parseFloat(lens[2]) !== 0) add("noBlurredShadow", el, layer.trim());
      }
    }

    // --- no filter: blur()
    if (cs.filter && cs.filter.includes("blur(") && !cs.filter.startsWith("blur(0")) {
      add("noBlur", el, cs.filter);
    }

    // --- noRadius: 0 everywhere, except a shape primitive's 50%/100% arc
    const isShape = el.classList && el.classList.contains("bq-shape");
    if (!isShape) {
      for (const corner of ["borderTopLeftRadius", "borderTopRightRadius",
                            "borderBottomRightRadius", "borderBottomLeftRadius"]) {
        const v = cs[corner];
        if (v && v !== "0px" && parseFloat(v) !== 0) { add("noRadius", el, `${corner}=${v}`); break; }
      }
    }

    if (!visible(el)) continue;

    // --- paletteOnly: computed colors must resolve to the eight values
    const isLangDot = el.classList && el.classList.contains("lang-dot");
    if (!isLangDot) {
      for (const prop of ["color", "backgroundColor", "borderTopColor", "outlineColor"]) {
        const v = cs[prop];
        if (!v || v === "rgba(0, 0, 0, 0)") continue;
        if (prop === "borderTopColor" && parseFloat(cs.borderTopWidth) === 0) continue;
        if (prop === "outlineColor" && cs.outlineStyle === "none") continue;
        if (!paletteKeys.includes(v)) add("paletteOnly", el, `${prop}=${v}`);
      }
    }

    // --- contrastAA: text must clear 4.5:1, or 3:1 when large (spec p.05/p.23).
    // Red on paper is 3.79:1, so a paragraph that inherits red is a violation.
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (ownText) {
      let bgEl = el, bg = "rgba(0, 0, 0, 0)";
      while (bgEl) {
        const c = getComputedStyle(bgEl).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && !c.endsWith(", 0)")) { bg = c; break; }
        bgEl = bgEl.parentElement;
      }
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      out.push({ rule: "__contrast", selector: sel(el), fg: cs.color, bg, large,
                 size: Math.round(size) });
    }

    // --- targetSize: interactive elements >= 44x44 (spec p.23)
    if (["A", "BUTTON"].includes(el.tagName) && cs.display !== "inline"
        && !el.classList.contains("visually-hidden")) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) {
        add("targetSize", el, `${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
  }

  // --- visibleDecoration: spec p.10 deliberately leaves roughly one cell in
  // four as paper -- that is negative space, not a bug. But a column reduced
  // to a SINGLE tile (the tall-phone tier) rendering that one tile in a paper
  // tone draws an invisible square and nothing else. Document order put a
  // paper tile at the head of the right column once already.
  const PAPERS = ["rgb(239, 231, 215)", "rgb(247, 242, 231)", "rgb(226, 215, 194)"];
  for (const col of document.querySelectorAll(".tile-column")) {
    const shown = [...col.children].filter(visible);
    if (shown.length !== 1) continue;
    const fill = getComputedStyle(shown[0]).backgroundColor;
    let anc = shown[0].parentElement, ground = "rgba(0, 0, 0, 0)";
    while (anc) {
      const c = getComputedStyle(anc).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && !c.endsWith(", 0)")) { ground = c; break; }
      anc = anc.parentElement;
    }
    if (PAPERS.includes(fill) && PAPERS.includes(ground)) {
      add("visibleDecoration", col, `lone tile ${fill} on ${ground} — invisible`);
    }
  }

  // --- forcedColors: Windows High Contrast strips box-shadow, which is this
  // system's only depth cue. A button must still read as a button from its
  // border alone. (Review Focus 1)
  // Scoped to controls that carry an offset: those are the ones whose only
  // depth cue the OS removes. A flat indicator (a slideshow dot) has no depth
  // to lose and is not claimed by Review Focus 1.
  for (const btn of document.querySelectorAll(".btn, .icon-btn, button, [role='button']")) {
    if (!visible(btn)) continue;
    const bs = getComputedStyle(btn);
    const carriesOffset = bs.boxShadow && bs.boxShadow !== "none";
    if (!carriesOffset) continue;
    if (parseFloat(bs.borderTopWidth) < 2 || bs.borderTopStyle === "none") {
      add("forcedColors", btn, `offset without border: ${bs.borderTopWidth} ${bs.borderTopStyle} — needs >=2px solid`);
    }
  }

  // --- noClayToken: the old custom properties must be gone
  const rootCS = getComputedStyle(document.documentElement);
  for (const name of ["--clay-dark", "--clay-light", "--clay-dark-soft",
                      "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-pill"]) {
    if (rootCS.getPropertyValue(name).trim() !== "") {
      add("noClayToken", document.documentElement, `${name} still defined`);
    }
  }

  // --- noHorizontalOverflow
  const de = document.documentElement;
  if (de.scrollWidth - de.clientWidth > 1) {
    add("noHorizontalOverflow", de, `${de.scrollWidth} > ${de.clientWidth}`);
  }

  return out;
};

/* ---- runner --------------------------------------------------------------- */

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const { server, port } = await serve();
const browser = await chromium.launch();
const violations = [];

for (const page of PAGES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${port}/${page}`, { waitUntil: "networkidle" });
    // walk the page so reveal-on-scroll elements are in their settled state
    const total = await p.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < total; y += vp.h / 2) {
      await p.evaluate((v) => window.scrollTo(0, v), y);
      await p.waitForTimeout(90);
    }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(400);

    for (const v of await p.evaluate(IN_PAGE, Object.keys(PALETTE))) {
      if (v.rule === "__contrast") {
        const ratio = contrastRatio(v.fg, v.bg);
        const floor = v.large ? 3 : 4.5;
        if (ratio < floor) {
          violations.push({ page, viewport: vp.name, rule: "contrastAA", selector: v.selector,
            actual: `${ratio.toFixed(2)}:1 < ${floor} (${v.size}px ${v.fg} on ${v.bg})` });
        }
        continue;
      }
      if (only && v.rule !== only) continue;
      violations.push({ page, viewport: vp.name, ...v });
    }
    await ctx.close();
  }
}

await browser.close();
server.close();

const byRule = {};
for (const v of violations) (byRule[v.rule] ??= []).push(v);

if (violations.length === 0) {
  console.log("PASS — all assertions clean across 2 pages x 3 viewports");
  process.exit(0);
}

for (const [rule, list] of Object.entries(byRule)) {
  console.log(`\n${rule}: ${list.length} violation(s)`);
  for (const v of list.slice(0, 6)) {
    console.log(`  ${v.page} ${v.viewport} ${v.selector} ${v.actual}`);
  }
  if (list.length > 6) console.log(`  ... and ${list.length - 6} more`);
}
console.log(`\nFAIL — ${violations.length} violation(s) across ${Object.keys(byRule).length} rule(s)`);
process.exit(1);
