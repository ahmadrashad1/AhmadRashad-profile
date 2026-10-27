/**
 * Review Focus 3: the reveal animation must not swallow the hover lift.
 *
 * A finished `animation ... forwards` holds its final value above normal
 * declarations. The clay build hit this: revealing on `transform` meant the
 * hover `translateY(-6px)` silently stopped working once a card had revealed.
 * The fix is to reveal on `translate` and hover on `transform` — two
 * independent properties that compose. This pins it.
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

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`http://127.0.0.1:${port}/work.html`, { waitUntil: "networkidle" });

// scroll so the cards reveal and their animations finish
const total = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < total; y += 400) { await p.evaluate(v => scrollTo(0,v), y); await p.waitForTimeout(120); }
await p.waitForTimeout(900);

const card = p.locator(".frontend-card").first();
await card.scrollIntoViewIfNeeded();
await p.waitForTimeout(700);

const revealed = await card.evaluate(el => el.classList.contains("is-visible"));
check("card actually revealed", revealed, revealed ? "is-visible" : "never revealed — test proves nothing");

// the reveal must animate `translate`, leaving `transform` free for hover
const animProps = await card.evaluate(el =>
  el.getAnimations().map(a => [...new Set((a.effect?.getKeyframes() ?? []).flatMap(k => Object.keys(k)))]).flat());
check("reveal does not animate transform", !animProps.includes("transform"),
  `animates: ${animProps.filter(k => !["offset","composite","computedOffset","easing"].includes(k)).join(", ") || "(finished)"}`);

const before = await card.evaluate(el => getComputedStyle(el).transform);
await card.hover();
await p.waitForTimeout(300);
const after = await card.evaluate(el => getComputedStyle(el).transform);
check("hover still moves a revealed card", before !== after, `${before} -> ${after}`);

await browser.close(); server.close();
console.log(failed === 0 ? `\nPASS — 3/3` : `\nFAIL — ${failed}/3 failing`);
process.exit(failed === 0 ? 0 : 1);
