#!/usr/bin/env node
// Builds one self-contained preview page (player + event list) from a project.
// Usage: node preview.mjs <project-dir> [out.html]
// The page inlines cast.js, clock.js, sky.js and the fonts, so it can be published
// as a Claude artifact or opened straight from disk.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] || ".");
const out = path.resolve(process.argv[3] || path.join(dir, "preview.html"));
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const font = (f) => `data:font/woff2;base64,${fs.readFileSync(path.join(dir, "fonts", f)).toString("base64")}`;

let sky = read("sky.js");
for (const f of fs.readdirSync(path.join(dir, "fonts")).filter((f) => f.endsWith(".woff2"))) {
  sky = sky.replaceAll(`url(fonts/${f})`, `url(${font(f)})`);
}
const { duration, events } = JSON.parse(read("events.json"));
const lang = (read("cast.js").match(/lang:\s*"(\w+)"/) || [])[1] || "en";
const de = lang === "de";
const T = de
  ? { title: "Life Constellation – Vorschau", play: "Abspielen", pause: "Pause", age: "Alter", events: "Momente", note: "Vorschau im Browser. Das fertige Video wird Bild für Bild mit HyperFrames gerendert." }
  : { title: "Life Constellation preview", play: "Play", pause: "Pause", age: "Age", events: "Moments", note: "Browser preview. The final video is rendered frame by frame with HyperFrames." };

const DE = [["becomes the biggest star", "wird zum größten Stern"], ["is a star", "ist ein Stern"], ["joins", "kommt"], ["crosses", "kreuzt"],
  ["leaves", "zieht weg"], ["rises", "steigt auf"], ["constellation draws", "Sternbild entsteht"], ["closing text", "Schlusstext"], ["fade to black", "Abblende"]];
const say = (w) => (de ? DE.reduce((s, [a, b]) => s.replace(a, b), w) : w);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = `<title>Life Constellation</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* Layout: the 9:16 film on the left, its moments as a jump list on the right; stacked on phones. */
  @font-face { font-family: "LCSerifUI"; src: url(${font("cormorant-garamond-latin-500-normal.woff2")}) format("woff2"); font-weight: 500; }
  :root {
    --night: #050a1f; --panel: #0c1534; --line: #1e2a55; --ink: #e9e6f2; --dim: #9ea6c7; --gold: #ffd84d;
    --serif: "LCSerifUI", "Cormorant Garamond", Georgia, serif; --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
    color-scheme: dark;
  }
  html, body { background: var(--night); color: var(--ink); }
  body { font-family: var(--sans); padding-block: 20px 32px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  .wrap { max-width: 1040px; margin: 0 auto; display: grid; grid-template-columns: min(440px, max(260px, calc((100vh - 180px) * 9 / 16))) minmax(0, 1fr); gap: 28px; align-items: start; }
  h1 { font-family: var(--serif); font-weight: 500; font-size: 2rem; letter-spacing: 0.01em; margin: 0 0 4px; text-wrap: balance; }
  .note { color: var(--dim); font-size: 0.85rem; margin: 0 0 16px; max-width: 60ch; }
  .film { width: 100%; min-width: 0; }
  canvas { display: block; width: 100%; height: auto; aspect-ratio: 9 / 16; max-width: 100%; border-radius: 6px; background: var(--night); outline: 1px solid var(--line); }
  .bar { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
  button { font: inherit; color: var(--night); background: var(--gold); border: 0; border-radius: 999px; padding: 8px 16px; font-weight: 600; cursor: pointer; min-width: 92px; }
  button:focus-visible, input:focus-visible, li button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  input[type=range] { flex: 1; min-width: 0; accent-color: var(--gold); }
  .time { font-variant-numeric: tabular-nums; color: var(--dim); font-size: 0.85rem; white-space: nowrap; }
  .time b { color: var(--gold); font-weight: 600; }
  h2 { font-family: var(--serif); font-weight: 500; font-size: 1.35rem; margin: 0 0 8px; }
  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  li button { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 4.2em minmax(0, 1fr); gap: 10px; width: 100%; padding: 6px 10px; border-radius: 6px; cursor: pointer; color: var(--ink); font-size: 0.92rem; }
  li button:hover { background: var(--panel); }
  li button[aria-current="true"] { background: var(--panel); box-shadow: inset 2px 0 0 var(--gold); }
  li .s { color: var(--dim); font-variant-numeric: tabular-nums; }
  @media (max-width: 720px) { .wrap { grid-template-columns: minmax(0, 1fr); } .film { width: min(100%, 440px); margin: 0 auto; } }
</style>
<div class="wrap">
  <div class="film">
    <canvas id="sky" width="1080" height="1920" aria-label="${esc(T.title)}"></canvas>
    <div class="bar">
      <button id="play" type="button">${T.play}</button>
      <input id="scrub" type="range" min="0" max="${duration}" step="0.01" value="0" aria-label="${de ? "Zeit" : "Time"}">
      <span class="time"><span id="clock">0:00</span> · ${T.age} <b id="age">0</b></span>
    </div>
  </div>
  <div>
    <h1>Life Constellation</h1>
    <p class="note">${esc(T.note)}</p>
    <h2>${T.events}</h2>
    <ol id="events">${events.map((e, i) => `<li><button type="button" data-t="${e.t}" id="ev${i}"><span class="s">${e.t.toFixed(1)} s</span><span>${esc(say(e.what))}</span></button></li>`).join("")}</ol>
  </div>
</div>
<script>${read("cast.js")}</script>
<script>${read("clock.js")}</script>
<script>${sky}</script>
<script>
(() => {
  const D = ${duration};
  const play = document.getElementById("play"), scrub = document.getElementById("scrub");
  const clock = document.getElementById("clock"), age = document.getElementById("age");
  const evs = [...document.querySelectorAll("#events button")];
  let t = 0, playing = false, last = 0;
  const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  function show(nt) {
    t = Math.max(0, Math.min(D, nt));
    window.dispatchEvent(new CustomEvent("hf-seek", { detail: { time: t } }));
    scrub.value = t; clock.textContent = fmt(t);
    age.textContent = Math.max(0, Math.floor(window.__lc.ageAt(t) + 1e-6));
    let cur = -1; evs.forEach((b, i) => { if (+b.dataset.t <= t + 0.05) cur = i; });
    evs.forEach((b, i) => b.setAttribute("aria-current", String(i === cur)));
  }
  function loop(now) {
    if (!playing) return;
    show(t + Math.min(0.1, (now - last) / 1000)); last = now;
    if (t >= D) { playing = false; play.textContent = "${T.play}"; return; }
    requestAnimationFrame(loop);
  }
  play.addEventListener("click", () => {
    playing = !playing; play.textContent = playing ? "${T.pause}" : "${T.play}";
    if (playing) { if (t >= D) t = 0; last = performance.now(); requestAnimationFrame(loop); }
  });
  scrub.addEventListener("input", () => show(+scrub.value));
  evs.forEach((b) => b.addEventListener("click", () => show(+b.dataset.t)));
  show(${events.length > 1 ? events[events.length - 2].t : 0});
})();
</script>
`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + " KB");
