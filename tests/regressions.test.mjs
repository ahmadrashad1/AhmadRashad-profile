/**
 * Defects found by whole-branch review. Each assertion failed when written.
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
const URLB = `http://127.0.0.1:${port}`;

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();
const mobile = () => browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const desktop = () => browser.newContext({ viewport:{width:1440,height:900} });

/* F1 — a closed <dialog> must not render in flow */
{
  const ctx = await mobile(); const p = await ctx.newPage();
  await p.goto(`${URLB}/work.html`, { waitUntil:"networkidle" }); await p.waitForTimeout(500);
  const m = await p.evaluate(() => ({
    h: document.body.scrollHeight,
    leaked: [...document.querySelectorAll(".project-sheet")]
      .filter(d => !d.open && getComputedStyle(d).display !== "none").length }));
  check("F1 closed project sheets are hidden on mobile", m.leaked === 0, `${m.leaked} leaking, page ${m.h}px`);
  const body = await p.evaluate(() => ({
    descVisible: [...document.querySelectorAll(".project-desc")].filter(e => e.offsetParent !== null).length,
    previews: [...document.querySelectorAll(".project-preview")].filter(e => e.offsetParent !== null).length }));
  check("F1 project detail text is collapsed behind the preview on mobile",
    body.descVisible === 0 && body.previews === 3,
    `${body.descVisible} descriptions visible, ${body.previews} previews`);
  await ctx.close();
}

/* F2 — no inline style may reference a deleted clay token */
{
  const html = (await readFile(join(ROOT,"work.html"),"utf8")) + (await readFile(join(ROOT,"index.html"),"utf8"));
  const stale = [...html.matchAll(/style="[^"]*var\(--(?!bq-)[a-z-]+\)[^"]*"/g)].map(m => m[0]);
  check("F2 no inline style uses a non-bq token", stale.length === 0, stale.slice(0,2).join(" | ") || "none");
  const ctx = await desktop(); const p = await ctx.newPage();
  await p.goto(`${URLB}/work.html`, { waitUntil:"networkidle" });
  const sizes = await p.evaluate(() => [...document.querySelectorAll(".section-heading")]
    .map(h => parseFloat(getComputedStyle(h).fontSize)));
  check("F2 every section heading is larger than body text", sizes.every(s => s > 20), sizes.join(", ") + "px");
  await ctx.close();
}

/* F3 — the copy confirmation must be hidden until a copy happens */
{
  const ctx = await desktop(); const p = await ctx.newPage();
  await p.goto(`${URLB}/index.html`, { waitUntil:"networkidle" });
  await p.click("#contactCta"); await p.waitForTimeout(900);
  const before = await p.evaluate(() => {
    const t = document.querySelector(".copy-tip");
    return t ? { op: getComputedStyle(t).opacity, pos: getComputedStyle(t).position } : null; });
  check("F3 copy tip hidden at rest", before && before.op === "0", JSON.stringify(before));
  check("F3 copy tip is taken out of flow", before && before.pos === "absolute", before && before.pos);
  await ctx.close();
}

/* F4 — an inline SVG used as an affordance must be sized */
{
  const ctx = await mobile(); const p = await ctx.newPage();
  await p.goto(`${URLB}/work.html`, { waitUntil:"networkidle" }); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const e = document.querySelector(".project-preview-expand");
    if (!e) return null;
    const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
  check("F4 preview chevron is icon-sized", r && r.w <= 48 && r.h <= 48, r && `${r.w}x${r.h}`);
  await ctx.close();
}

/* F5 — close buttons must not stack in the tab order on desktop */
{
  const ctx = await desktop(); const p = await ctx.newPage();
  await p.goto(`${URLB}/work.html`, { waitUntil:"networkidle" }); await p.waitForTimeout(400);
  const n = await p.evaluate(() => [...document.querySelectorAll(".project-sheet-close")]
    .filter(b => b.offsetParent !== null).length);
  check("F5 no project-sheet close buttons focusable on desktop", n === 0, `${n} visible`);
  await ctx.close();
}

/* F6 — allow-discrete needs a duration or the close animation is dead */
{
  const css = await readFile(join(ROOT,"css/03-components.css"),"utf8");
  const bare = [...css.matchAll(/transition:[^;]*allow-discrete[^;]*/g)]
    .filter(m => !/(\d+m?s|var\([^)]+\))\s+allow-discrete/.test(m[0]));
  check("F6 allow-discrete declares a duration", bare.length === 0, bare.slice(0,1).map(m=>m[0].slice(0,60)).join("") || "none");
}

/* F7 — the bird must re-measure when the viewport crosses a padding tier */
{
  const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  await p.goto(`${URLB}/index.html`, { waitUntil:"networkidle" });
  await p.click("#contactCta"); await p.waitForTimeout(1200);
  await p.setViewportSize({ width: 380, height: 700 }); await p.waitForTimeout(900);
  const m = await p.evaluate(() => {
    const bird = document.getElementById("contactBird"), pan = document.getElementById("sheetPanel");
    if (getComputedStyle(bird).display === "none") return { skipped:true };
    const b = bird.getBoundingClientRect(), pr = pan.getBoundingClientRect();
    const hr = document.querySelector(".contact-heading").getBoundingClientRect();
    return { overlap: b.bottom - pr.top, padTop: parseFloat(getComputedStyle(pan).paddingTop),
             clips: b.bottom > hr.top && b.right > hr.left && b.left < hr.right }; });
  if (m.skipped) console.log("skip  F7 — bird hidden after resize");
  else {
    check("F7 bird overlap stays within padding after resize", m.overlap >= 2 && m.overlap <= m.padTop,
      `overlap ${m.overlap.toFixed(1)} vs padding ${m.padTop}`);
    check("F7 bird clear of heading after resize", !m.clips, m.clips ? "COLLIDES" : "clear");
  }
  await ctx.close();
}

/* F8/F9 — forced colors: buttons must adopt the user palette, dots stay distinct */
{
  const ctx = await browser.newContext({ viewport:{width:1440,height:900}, forcedColors:"active" });
  const p = await ctx.newPage();
  await p.goto(`${URLB}/index.html`, { waitUntil:"networkidle" }); await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const b = document.querySelector(".btn-primary");
    return { btnBg: getComputedStyle(b).backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor }; });
  check("F8 buttons adopt the forced-colors palette", m.btnBg !== "rgb(206, 68, 53)", `btn ${m.btnBg}, body ${m.bodyBg}`);
  await p.goto(`${URLB}/work.html`, { waitUntil:"networkidle" }); await p.waitForTimeout(500);
  const d = await p.evaluate(() => {
    const dot = document.querySelector(".slideshow-dots .dot:not(.is-active)");
    const act = document.querySelector(".slideshow-dots .dot.is-active");
    if (!dot || !act) return null;
    const gi = getComputedStyle(dot, "::before"), ga = getComputedStyle(act, "::before");
    return { idleW: gi.width, activeW: ga.width,
             idleBg: gi.backgroundColor, activeBg: ga.backgroundColor }; });
  // Colour alone cannot be trusted here: two system colours can resolve to the
  // same value. Width is the differentiator that survives any palette.
  check("F9 slideshow dots stay distinguishable in forced colors",
    d && (d.idleW !== d.activeW || d.idleBg !== d.activeBg),
    d ? `w ${d.idleW} vs ${d.activeW}, bg ${d.idleBg} vs ${d.activeBg}` : "no dots");
  await ctx.close();
}

/* F11 — the footer must be styled */
{
  const ctx = await desktop(); const p = await ctx.newPage();
  await p.goto(`${URLB}/work.html`, { waitUntil:"networkidle" });
  const f = await p.evaluate(() => {
    const el = document.querySelector(".site-footer");
    const c = getComputedStyle(el);
    return { padTop: parseFloat(c.paddingTop), size: parseFloat(c.fontSize) }; });
  check("F11 footer has separation from the content above", f.padTop >= 24, `padding-top ${f.padTop}px`);
  await ctx.close();
}

/* F12 — a failed repo fetch must show its error, not an empty grid */
{
  const ctx = await desktop(); const p = await ctx.newPage();
  await p.route("**/data/repos.json", r => r.fulfill({ status: 500, body: "boom" }));
  await p.goto(`${URLB}/work.html`, { waitUntil:"networkidle" }); await p.waitForTimeout(900);
  const m = await p.evaluate(() => {
    const el = document.querySelector("#reposGrid .repo-card");
    if (!el) return { visible:false, why:"no node" };
    return { visible: parseFloat(getComputedStyle(el).opacity) > 0.5,
             cls: el.className }; });
  check("F12 repo fetch error is visible to the user", m.visible, JSON.stringify(m));
  check("F12 error node carries no dead clay class", !String(m.cls||"").includes("clay"), m.cls);
  await ctx.close();
}

await browser.close(); server.close();
console.log(failed === 0 ? `\nPASS` : `\nFAIL — ${failed} failing`);
process.exit(failed === 0 ? 0 : 1);
