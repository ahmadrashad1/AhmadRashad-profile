/**
 * Review Focus 4: index.html is a locked single viewport. It must not
 * scroll and must not clip at any shape -- including landscape phone
 * (844x390), which has side margin and no vertical slack, the opposite
 * shape from portrait, and is deliberately excluded from the tall-phone tier.
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

const CASES = [
  { w: 1440, h: 900, name: "desktop" },
  { w: 1440, h: 720, name: "short laptop" },
  { w: 390,  h: 844, name: "phone portrait" },
  { w: 844,  h: 390, name: "phone landscape" },
  { w: 820,  h: 1180, name: "tablet" },
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
  await p.waitForTimeout(500);

  const m = await p.evaluate(() => {
    const stack = document.querySelector(".hero-stack");
    const r = stack.getBoundingClientRect();
    return {
      scrollH: document.body.scrollHeight,
      innerH: window.innerHeight,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      stackTop: r.top,
      stackBottom: r.bottom,
      nameVisible: document.querySelector(".hero-name").getBoundingClientRect().height > 0,
      ctaVisible: document.querySelectorAll(".hero-actions .btn").length,
    };
  });

  check(`${c.name}: does not scroll`, m.scrollH <= m.innerH + 1, `body ${m.scrollH} vs viewport ${m.innerH}`);
  check(`${c.name}: no horizontal overflow`, m.overflowX <= 1, `${m.overflowX}px`);
  check(`${c.name}: hero fits without clipping`,
    m.stackTop >= -1 && m.stackBottom <= m.innerH + 1,
    `top ${m.stackTop.toFixed(0)} bottom ${m.stackBottom.toFixed(0)} / ${m.innerH}`);
  check(`${c.name}: name and both CTAs present`, m.nameVisible && m.ctaVisible === 2, `${m.ctaVisible} CTAs`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed === 0 ? `\nPASS` : `\nFAIL — ${failed} failing`);
process.exit(failed === 0 ? 0 : 1);
