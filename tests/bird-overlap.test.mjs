/**
 * Review Focus 2: the bird's landing offset is computed at runtime from
 * --sheet-panel-height (sheetPanel.offsetHeight, measured after showModal()).
 * Squaring the panel's corners and changing its padding changes that height,
 * so the overlap must be re-verified by measured rect at every breakpoint
 * where the panel's own padding steps down. The clay build's notes record
 * that this is invisible in a screenshot.
 */
import { chromium } from "/home/ahmadrashad/.local/share/pnpm/global/5/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MIME = { ".html":"text/html",".css":"text/css",".js":"text/javascript",".json":"application/json",
  ".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webm":"video/webm",".mp4":"video/mp4" };
const server = createServer(async (req,res) => {
  try { const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");
    const f = join(ROOT, rel === "/" ? "index.html" : rel);
    res.writeHead(200,{ "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(await readFile(f));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0,"127.0.0.1",r));
const port = server.address().port;

// The three breakpoints where .sheet-panel's own top padding changes.
const CASES = [
  { w: 1440, h: 900, name: "desktop" },
  { w: 600,  h: 900, name: "narrow (<=640)" },
  { w: 1024, h: 720, name: "short (<=760h)" },
];

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();
for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h } });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await p.click("#contactBtn, .btn-primary");
  await p.waitForTimeout(1400);   // let the bird + two-phase rise settle

  const m = await p.evaluate(() => {
    const bird = document.getElementById("contactBird");
    const panel = document.getElementById("sheetPanel");
    const heading = document.querySelector(".contact-heading");
    if (!bird || !panel) return null;
    if (getComputedStyle(bird).display === "none") return { skipped: true };
    const b = bird.getBoundingClientRect(), pr = panel.getBoundingClientRect(),
          hr = heading.getBoundingClientRect();
    return {
      overlap: b.bottom - pr.top,                    // how far the bird sinks into the panel
      padTop: parseFloat(getComputedStyle(panel).paddingTop),
      clipsHeading: b.bottom > hr.top && b.right > hr.left && b.left < hr.right,
      panelOpen: pr.height > 0,
    };
  });

  if (!m) { check(`${c.name}: elements present`, false, "bird or panel missing"); continue; }
  if (m.skipped) { console.log(`skip  ${c.name} — bird hidden at this size`); continue; }

  check(`${c.name}: panel actually opened`, m.panelOpen, `height ${m.panelOpen}`);
  // The bird must grip the panel: sunk in by at least 2px, but never deeper
  // than the panel's own top padding or it collides with the heading.
  check(`${c.name}: bird grips the panel edge`,
    m.overlap >= 2 && m.overlap <= m.padTop,
    `overlap ${m.overlap.toFixed(1)}px, panel padding-top ${m.padTop}px`);
  check(`${c.name}: bird clear of the heading`, !m.clipsHeading,
    m.clipsHeading ? "OVERLAPS heading text" : "no intersection");

  await ctx.close();
}
await browser.close(); server.close();
console.log(failed === 0 ? `\nPASS` : `\nFAIL — ${failed} failing`);
process.exit(failed === 0 ? 0 : 1);
