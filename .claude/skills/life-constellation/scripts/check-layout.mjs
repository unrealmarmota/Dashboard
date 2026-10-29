#!/usr/bin/env node
// Checks every 0.1 s of the film for names on names, names on stars and text cut off.
// Usage: node check-layout.mjs <project-dir>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const dir = path.resolve(process.argv[2] || ".");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = await import("playwright")); }

const types = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(dir, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.waitForFunction(() => window.__lc && window.__lc.ready());

const problems = await page.evaluate(() => {
  const { W, H, duration } = window.__lc;
  const out = [];
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  for (let i = 0; i * 0.1 <= duration; i++) {
    const t = +(i * 0.1).toFixed(1);
    const B = window.__lc.boxes(t).filter((b) => b.alpha == null || b.alpha > 0.3);
    for (const b of B) {
      if (b.kind === "star") continue;
      if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H) out.push({ t, issue: "cut off", a: b.text });
    }
    for (let m = 0; m < B.length; m++) for (let n = m + 1; n < B.length; n++) {
      const a = B[m], b = B[n];
      if (a.kind === "star" && b.kind === "star") continue;
      if (a.id && a.id === b.id && (a.kind === "star" || b.kind === "star")) continue;
      if (!hit(a, b) || area(a, b) < 4) continue;
      const star = a.kind === "star" || b.kind === "star";
      out.push({ t, issue: star ? "star hidden by text" : "text on text", a: a.text || a.id, b: b.text || b.id });
    }
  }
  return out;
});
await browser.close();
server.close();

// merge consecutive samples of the same problem into ranges
const ranges = [];
for (const p of problems) {
  const key = `${p.issue}|${p.a}|${p.b || ""}`;
  const last = ranges.findLast((r) => r.key === key);
  if (last && p.t - last.to <= 0.11) last.to = p.t; else ranges.push({ key, ...p, from: p.t, to: p.t });
}
if (!ranges.length) { console.log("layout OK: no overlaps, nothing cut off"); process.exit(0); }
for (const r of ranges) console.log(`${r.from.toFixed(1)}–${r.to.toFixed(1)} s  ${r.issue}: ${r.a}${r.b ? " × " + r.b : ""}`);
process.exit(1);
