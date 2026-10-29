// Life Constellation – the sky.
// Every frame is a pure function of video time t: drawFrame(t) reads only t,
// the cast (cast.js) and the clock table (clock.js). No timers, no rAF, no Math.random.
(() => {
  const W = 1080, H = 1920;
  const NOW = Math.round(H * 0.52);   // the "now" line
  const PX = 80;                      // px per year
  const FADE_Y = H * 0.75;            // lines fade out below this
  const AXIS_X = 92;                  // age axis
  const LEFT = 108;                   // labels stay right of the axis
  const CROSS_S = 3;                  // seconds a crosser needs for the screen
  const ENTER_S = 1.4, LEAVE_S = 1.4, BEND_S = 0.9, RISE_S = 1.5;

  const CAST = window.LC_CAST, CLOCK = window.LC_CLOCK, END = CAST.ending;
  const T_END = CLOCK.lifeEnd;

  const canvas = document.getElementById("sky");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const octx = off.getContext("2d");

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
  const easeIn = (u) => Math.pow(clamp(u), 2.2);
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mixWhite = (c, u) => c.map((v) => Math.round(lerp(v, 255, u)));

  // ---------- clock ----------
  const AG = CLOCK.ages, STEP = CLOCK.step;
  function ageAt(t) {
    if (t >= T_END) return CLOCK.endAge;
    const i = t / STEP;
    if (i <= 0) return AG[0] + (AG[1] - AG[0]) * i;
    const i0 = Math.floor(i);
    return lerp(AG[i0], AG[Math.min(i0 + 1, AG.length - 1)], i - i0);
  }
  function timeOfAge(a) {
    if (a >= CLOCK.endAge) return T_END + (a - CLOCK.endAge) / CLOCK.vEnd;
    if (a <= AG[0]) return ((a - AG[0]) / (AG[1] - AG[0])) * STEP;
    let lo = 0, hi = AG.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (AG[m] < a) lo = m; else hi = m; }
    return (lo + (a - AG[lo]) / (AG[hi] - AG[lo])) * STEP;
  }
  // ages that `s` seconds cover, starting (dir>0) or ending (dir<0) at age a
  const agesFor = (a, s) => Math.abs(ageAt(timeOfAge(a) + s) - a);
  const agesBefore = (a, s) => a - ageAt(timeOfAge(a) - s);
  // the child keeps living after my clock stops
  const childAge = (t) => (t <= T_END ? ageAt(t) : CLOCK.endAge + (t - T_END) * CLOCK.vEnd);

  // ---------- people ----------
  const byId = {};
  const people = CAST.people.map((p, idx) => {
    const P = { ...p, idx, rgb: hexRgb(p.color) };
    byId[p.id] = P;
    const R = rng(1000 + idx * 7919);
    P.ph1 = R() * 6.28; P.ph2 = R() * 6.28;
    return P;
  });

  for (const P of people) {
    const kfX = (k) => (typeof k[1] === "string" ? byId[k[1]].xAt(k[0]) : k[1]);
    let base;
    if (P.type === "crosses") {
      const tm = timeOfAge(P.at);
      P.t0 = tm - CROSS_S / 2; P.t1 = tm + CROSS_S / 2;
      P.start = ageAt(P.t0); P.endA = ageAt(P.t1);
      const xa = P.dir > 0 ? -60 : W + 60, xb = W + 120 - xa;
      base = (a) => lerp(xa, xb, (timeOfAge(a) - P.t0) / CROSS_S);
    } else {
      const K = P.path;
      base = (a) => {
        if (a <= K[0][0]) return kfX(K[0]);
        for (let i = 1; i < K.length; i++) {
          if (a <= K[i][0]) return lerp(kfX(K[i - 1]), kfX(K[i]), smooth((a - K[i - 1][0]) / (K[i][0] - K[i - 1][0])));
        }
        return kfX(K[K.length - 1]);
      };
      P.start = P.type === "family" ? -20 : P.from;
      P.endA = Infinity;
      if (P.id === CAST.me) P.endA = CLOCK.endAge;
      if (P.end?.star != null) { P.endA = P.end.star; P.tStar = timeOfAge(P.end.star); }
      if (P.end?.leaves != null) { P.leaveA = agesFor(P.end.leaves, LEAVE_S); P.endA = P.end.leaves + P.leaveA; }
      if (P.type === "joins" && (P.enter === "left" || P.enter === "right")) P.enterA = agesFor(P.from, ENTER_S);
      if (P.end?.star != null) P.bendA = agesBefore(P.end.star, BEND_S);
    }
    const wobbly = P.type !== "crosses";
    P.xAt = (a) => {
      let x = base(a);
      if (wobbly) {
        const ramp = P.type === "family" ? 1 : smooth((a - P.start) / 1.2);
        x += ramp * (5 * Math.sin(a * 1.7 + P.ph1) + 3 * Math.sin(a * 0.61 + P.ph2));
      }
      if (P.enterA) {
        const off = P.enter === "left" ? -90 : W + 90;
        x = lerp(off, x, easeOut((a - P.from) / P.enterA));
      }
      if (P.leaveA) {
        const off = P.end.side === "left" ? -120 : W + 120;
        x = lerp(x, off, easeIn((a - P.end.leaves) / P.leaveA));
      }
      if (P.bendA) x += P.end.bend * 75 * easeIn((a - (P.end.star - P.bendA)) / P.bendA);
      return x;
    };
  }
  const me = byId[CAST.me], child = byId[CAST.child];

  // ---------- stars in the sky ----------
  const stars = people.filter((P) => P.end?.star != null).map((P) => ({
    P, tDie: P.tStar, tArrive: P.tStar + RISE_S,
    from: [P.xAt(P.end.star), NOW], to: P.end.sky, r: 13,
  }));
  const meStar = { P: me, tDie: T_END, tArrive: T_END + 0.9, from: [me.xAt(CLOCK.endAge), NOW], to: [me.xAt(CLOCK.endAge), NOW], r: 26, big: true };
  const allStars = [...stars, meStar];
  const starOf = Object.fromEntries(allStars.map((s) => [s.P.id, s]));

  function sparkPos(s, t) {
    const u = smooth((t - s.tDie) / RISE_S);
    const [x0, y0] = s.from, [x1, y1] = s.to;
    const cx = x0 + (x1 - x0) * 0.15, cy = lerp(y0, y1, 0.85);
    const v = 1 - u;
    return [v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1];
  }

  // ---------- background ----------
  const R = rng(20240607);
  const bgStars = Array.from({ length: 500 }, () => ({
    x: R() * W, y: R() * H, r: 0.35 + Math.pow(R(), 3) * 1.6,
    a: 0.2 + R() * 0.7, f: 0.4 + R() * 1.8, p: R() * 6.28, warm: R() < 0.15,
  }));
  const bg = document.createElement("canvas");
  bg.width = W; bg.height = H;
  (() => {
    const b = bg.getContext("2d");
    const g = b.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#03061a"); g.addColorStop(0.45, "#0a1538"); g.addColorStop(0.8, "#081030"); g.addColorStop(1, "#04081a");
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    const N = rng(77);
    const clouds = [[0.25, 0.18, 520, [120, 70, 200]], [0.8, 0.36, 620, [150, 60, 190]], [0.35, 0.62, 560, [90, 60, 190]], [0.75, 0.86, 600, [130, 70, 210]], [0.55, 0.05, 420, [80, 90, 210]]];
    for (const [cx, cy, r, c] of clouds) {
      for (let i = 0; i < 3; i++) {
        const x = cx * W + (N() - 0.5) * 160, y = cy * H + (N() - 0.5) * 160, rr = r * (0.6 + N() * 0.5);
        const rg = b.createRadialGradient(x, y, 0, x, y, rr);
        rg.addColorStop(0, rgba(c, 0.07)); rg.addColorStop(0.5, rgba(c, 0.035)); rg.addColorStop(1, rgba(c, 0));
        b.fillStyle = rg; b.fillRect(0, 0, W, H);
      }
    }
  })();

  // ---------- fonts ----------
  const F_SANS = "LCInter", F_SERIF = "LCSerif";
  const font = (w, px, fam = F_SANS, style = "normal") => `${style} ${w} ${px}px ${fam}, sans-serif`;

  // ---------- labels (no name ever sits on another) ----------
  const LBL_PX = 30, LBL_H = 38;
  const widthCache = {};
  function textW(txt, f) {
    const k = f + "|" + txt;
    if (widthCache[k] == null) { ctx.font = f; widthCache[k] = ctx.measureText(txt).width; }
    return widthCache[k];
  }
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  function headsAt(t) {
    const cam = ageAt(t), out = [];
    const oldA = 1 - smooth(prog(t, T_END + END.fadeOld[0], T_END + END.fadeOld[1]));
    for (const P of people) {
      const a = P === child ? childAge(t) : cam;
      if (a < P.start || a > P.endA) continue;
      if (P === me && t >= T_END) continue;
      if (P.tStar != null && t >= P.tStar) continue;
      const x = P.xAt(a), y = NOW - (a - cam) * PX;
      let al = smooth((a - P.start) / Math.max(0.2, agesFor(P.start, 0.5)));
      if (P.type === "crosses") al *= 0.85;
      if (P !== child) al *= t < T_END ? 1 : 0;
      al *= clamp((x + 20) / 80) * clamp((W + 20 - x) / 80);
      if (al > 0.01) out.push({ P, x, y, al });
    }
    void oldA;
    return out;
  }

  function starBoxes(t) {
    const out = [];
    for (const s of allStars) {
      if (t < s.tArrive - 0.2) continue;
      const [x, y] = s.to, r = s.r * 1.6;
      out.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r, kind: "star", id: s.P.id });
      const f = font(500, s.big ? 32 : 26);
      const w = textW(s.P.name, f) + 10, ly = y + s.r + (s.big ? 34 : 24);
      out.push({ x: x - w / 2, y: ly - 16, w, h: 32, kind: "starname", id: s.P.id, tx: x, ty: ly, f });
    }
    return out;
  }

  function rawLayout(t) {
    const cam = ageAt(t);
    const fixed = [
      { x: 0, y: NOW - 30, w: AXIS_X + 6, h: 60, kind: "axis" },
      ...starBoxes(t),
    ];
    const heads = headsAt(t);
    const order = [...heads].sort((A, B) => {
      const ka = A.P.type === "crosses" ? 1 : 0, kb = B.P.type === "crosses" ? 1 : 0;
      if (ka !== kb) return ka - kb;
      if (A.P === me) return -1;
      if (B.P === me) return 1;
      return A.P.idx - B.P.idx;
    });
    const dots = heads.map((h) => ({ x: h.x - 11, y: h.y - 11, w: 22, h: 22, kind: "dot", id: h.P.id }));
    const placed = fixed.concat(dots), labels = {};
    const f = font(600, LBL_PX);
    for (const h of order) {
      const below = h.P.type === "crosses";
      const w = textW(h.P.name, f) + 14;
      const x0 = h.x, y0 = below ? h.y + 46 : h.y - 34;
      let x = x0, y = y0, lined = 0;
      const fit = (x) => clamp(x, LEFT + w / 2, W - 14 - w / 2);
      x = fit(x);
      for (let it = 0; it < 10; it++) {
        const b = { x: x - w / 2, y: y - LBL_H / 2, w, h: LBL_H };
        const hit = placed.find((o) => o.id !== h.P.id && overlap(b, o));
        if (!hit) break;
        const ov = Math.min(b.x + b.w, hit.x + hit.w) - Math.max(b.x, hit.x);
        const dir = x >= hit.x + hit.w / 2 ? 1 : -1;
        const nx = fit(x + dir * (ov + 6));
        if (ov < w * 0.5 && Math.abs(nx - x) > ov * 0.9 && hit.kind !== "axis") x = nx;
        else if (hit.kind === "axis") x = fit(hit.x + hit.w + w / 2 + 4);
        else { y += (below ? 1 : -1) * (LBL_H + 2); lined++; x = fit(x0); }
      }
      const box = { x: x - w / 2, y: y - LBL_H / 2, w, h: LBL_H, kind: "name", id: h.P.id };
      placed.push(box);
      labels[h.P.id] = { dx: x - h.x, dy: y - h.y, w, rank: Object.keys(labels).length };
    }
    return { heads, labels, fixed, dots, cam };
  }

  // Smooth label moves: average the placement over the last 0.3 s (still a pure function of t).
  function layout(t) {
    const now = rawLayout(t);
    const acc = {};
    for (let k = 0; k < 7; k++) {
      const L = k === 0 ? now : rawLayout(t - k * 0.05);
      for (const id in L.labels) {
        const a = (acc[id] = acc[id] || { dx: 0, dy: 0, n: 0 });
        a.dx += L.labels[id].dx; a.dy += L.labels[id].dy; a.n++;
      }
    }
    // The average can land two names on each other while they swap places:
    // then fall back to this frame's own (overlap-free) placement.
    const f = font(600, LBL_PX);
    const taken = now.fixed.slice();
    const names = [];
    const order = now.heads.slice().sort((A, B) => (now.labels[A.P.id].rank - now.labels[B.P.id].rank));
    for (const h of order) {
      const a = acc[h.P.id], L = now.labels[h.P.id], below = h.P.type === "crosses";
      const w = L.w;
      const box = (x, y) => ({ x: x - w / 2, y: y - LBL_H / 2, w, h: LBL_H });
      const free = (b) => !taken.some((o) => overlap(b, o)) && !now.dots.some((d) => d.id !== h.P.id && overlap(b, d));
      let x = clamp(h.x + a.dx / a.n, LEFT + w / 2, W - 14 - w / 2), y = h.y + a.dy / a.n;
      if (!free(box(x, y))) { x = h.x + L.dx; y = h.y + L.dy; }
      const b = box(x, y);
      taken.push(b);
      names.push({ h, x, y, w, below, f, box: b });
    }
    return { ...now, names };
  }

  // ---------- drawing ----------
  function drawBackground(t, cam) {
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(bg, 0, 0);
    const drift = cam * 3;
    for (const s of bgStars) {
      const y = (((s.y + drift) % H) + H) % H;
      const tw = 0.65 + 0.35 * Math.sin(t * s.f + s.p);
      ctx.fillStyle = s.warm ? `rgba(255,226,190,${s.a * tw})` : `rgba(220,230,255,${s.a * tw})`;
      if (s.r < 0.9) ctx.fillRect(s.x, y, s.r * 1.6, s.r * 1.6);
      else { ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.283); ctx.fill(); }
    }
  }

  function drawAxis(t, cam, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 140, 0, H);
    g.addColorStop(0, "rgba(200,210,255,0)"); g.addColorStop(0.15, "rgba(200,210,255,0.22)");
    g.addColorStop(0.75, "rgba(200,210,255,0.18)"); g.addColorStop(1, "rgba(200,210,255,0)");
    ctx.fillStyle = g; ctx.fillRect(AXIS_X, 140, 1.5, H - 140);
    ctx.font = font(400, 24); ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const lo = Math.ceil((cam - (H - NOW) / PX) / 5) * 5, hi = Math.floor((cam + NOW / PX) / 5) * 5;
    for (let a = Math.max(0, lo); a <= hi; a += 5) {
      const y = NOW + (cam - a) * PX;
      if (y < 150 || y > H - 10) continue;
      const near = clamp((Math.abs(y - NOW) - 30) / 30);
      const edge = clamp((y - 150) / 160) * clamp((H - y) / 260);
      ctx.fillStyle = `rgba(200,210,255,${0.55 * near * edge})`;
      ctx.fillRect(AXIS_X - 10, y - 0.75, 20, 1.5);
      ctx.fillText(String(a), AXIS_X - 18, y);
    }
    ctx.textAlign = "left";
    ctx.font = font(400, 28);
    ctx.fillStyle = "rgba(220,228,255,0.6)";
    ctx.fillText(CAST.text.axis, 36, 96);
    // the now line
    const n = ctx.createLinearGradient(AXIS_X, 0, W, 0);
    n.addColorStop(0, "rgba(255,240,200,0.22)"); n.addColorStop(0.7, "rgba(255,240,200,0.10)"); n.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = n; ctx.fillRect(AXIS_X, NOW - 0.5, W - AXIS_X, 1);
    ctx.restore();
  }

  // current age, yellow, on the now line – drawn over the lines so nothing passes over it
  function drawAge(cam, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(AXIS_X - 40, NOW, 0, AXIS_X - 40, NOW, 70);
    g.addColorStop(0, "rgba(4,8,26,0.85)"); g.addColorStop(1, "rgba(4,8,26,0)");
    ctx.fillStyle = g; ctx.fillRect(0, NOW - 70, AXIS_X + 30, 140);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFD84D";
    ctx.shadowColor = "rgba(255,216,77,0.6)"; ctx.shadowBlur = 14;
    ctx.font = font(600, 40);
    ctx.fillText(String(Math.max(0, Math.floor(cam + 1e-6))), AXIS_X - 14, NOW + 2);
    ctx.fillRect(AXIS_X - 8, NOW - 1, 16, 2);
    ctx.restore();
  }

  function personPath(P, cam, a0, a1) {
    const path = new Path2D();
    const step = 0.02;
    let first = true;
    for (let a = a0; ; a += step) {
      if (a > a1) a = a1;
      const x = P.xAt(a), y = NOW + (cam - a) * PX;
      if (first) { path.moveTo(x, y); first = false; } else path.lineTo(x, y);
      if (a >= a1) break;
    }
    return path;
  }

  function drawLines(t, cam) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.globalCompositeOperation = "source-over";
    octx.clearRect(0, 0, W, H);
    octx.globalCompositeOperation = "lighter";
    octx.lineCap = "round"; octx.lineJoin = "round";
    const oldA = 1 - smooth(prog(t, T_END + END.fadeOld[0], T_END + END.fadeOld[1]));
    for (const P of people) {
      const top = P === child ? childAge(t) : cam;
      const a1 = Math.min(top, P.endA);
      const a0 = Math.max(P.start, cam - (H - NOW) / PX - 0.3);
      if (a1 <= a0) continue;
      let al = P === child ? 1 : oldA;
      if (P.type === "crosses") al *= 0.55 * (1 - smooth(prog(t, P.t1 + 2, P.t1 + 5)));
      if (al <= 0.005) continue;
      const path = personPath(P, cam, a0, a1);
      const c = P.rgb, core = mixWhite(c, 0.35);
      octx.strokeStyle = rgba(c, 0.07 * al); octx.lineWidth = 24; octx.stroke(path);
      octx.strokeStyle = rgba(c, 0.2 * al); octx.lineWidth = 10; octx.stroke(path);
      octx.strokeStyle = rgba(core, 0.95 * al); octx.lineWidth = 3; octx.stroke(path);
    }
    // fade out in the bottom quarter (and, in the ending, everything under the now line)
    const e = smooth(prog(t, T_END + END.fadeOld[0], T_END + END.fadeOld[1] + 1));
    const f0 = lerp(FADE_Y, NOW + 20, e), f1 = lerp(H, NOW + 300, e);
    octx.globalCompositeOperation = "destination-in";
    const g = octx.createLinearGradient(0, f0, 0, f1);
    g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    octx.fillStyle = g; octx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(off, 0, 0);
  }

  function glowDot(x, y, r, c, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(0.35, rgba(c, a * 0.35)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  function drawHeads(L) {
    ctx.globalCompositeOperation = "lighter";
    for (const { P, x, y, al } of L.heads) {
      glowDot(x, y, 36, P.rgb, 0.55 * al);
      glowDot(x, y, 12, [255, 255, 255], 0.9 * al);
      ctx.fillStyle = `rgba(255,255,255,${al})`;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawNames(L) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const n of L.names) {
      const { P, x: hx, y: hy, al } = n.h;
      const c = mixWhite(P.rgb, 0.55);
      if (Math.abs(n.y - (n.below ? hy + 46 : hy - 34)) > 8) {
        ctx.strokeStyle = rgba(P.rgb, 0.35 * al); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hx, hy + (n.below ? 10 : -10));
        ctx.lineTo(n.x, n.y + (n.below ? -LBL_H / 2 + 4 : LBL_H / 2 - 4)); ctx.stroke();
      }
      ctx.font = n.f;
      ctx.lineJoin = "round"; ctx.lineWidth = 7;
      ctx.strokeStyle = `rgba(5,9,28,${0.75 * al})`;
      ctx.strokeText(P.name, n.x, n.y);
      ctx.shadowColor = rgba(P.rgb, 0.9 * al); ctx.shadowBlur = 16;
      ctx.fillStyle = rgba(c, (n.below ? 0.85 : 1) * al);
      ctx.fillText(P.name, n.x, n.y);
      ctx.shadowBlur = 0;
    }
  }

  function star4(x, y, r, c, a) {
    glowDot(x, y, r * 3.2, c, 0.45 * a);
    ctx.fillStyle = rgba(mixWhite(c, 0.6), a);
    const k = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + k, y - k, x + r, y);
    ctx.quadraticCurveTo(x + k, y + k, x, y + r);
    ctx.quadraticCurveTo(x - k, y + k, x - r, y);
    ctx.quadraticCurveTo(x - k, y - k, x, y - r);
    ctx.fill();
    glowDot(x, y, r * 0.7, [255, 255, 255], a);
  }

  function drawStars(t) {
    ctx.globalCompositeOperation = "lighter";
    for (const s of allStars) {
      if (t < s.tDie) continue;
      const c = s.P.rgb;
      if (s.big) {
        // my flare: a big warm bloom, then the biggest star, right where I stand
        const [x, y] = s.to;
        const fl = Math.sin(Math.PI * clamp((t - s.tDie) / 1.6)) * (t < s.tDie + 0.8 ? 1 : 1);
        const warm = [255, 214, 140];
        glowDot(x, y, 80 + 320 * fl, warm, 0.55 * fl + 0.0);
        glowDot(x, y, 40 + 120 * fl, [255, 245, 220], 0.7 * fl);
        const grow = easeOut((t - s.tDie - 0.4) / 1.0);
        if (grow > 0) star4(x, y, s.r * grow * (1 + 0.04 * Math.sin(t * 1.3)), warm, grow);
        continue;
      }
      if (t < s.tArrive) {
        // spark with a dotted tail
        for (let k = 16; k >= 0; k--) {
          const tk = t - k * 0.045;
          if (tk < s.tDie) continue;
          const [x, y] = sparkPos(s, tk), fa = 1 - k / 17;
          if (k === 0) { glowDot(x, y, 34, c, 0.8); glowDot(x, y, 10, [255, 255, 255], 1); }
          else if (k % 2 === 0) { ctx.fillStyle = rgba(mixWhite(c, 0.5), 0.75 * fa); ctx.beginPath(); ctx.arc(x, y, 1.2 + 2.6 * fa, 0, 6.283); ctx.fill(); }
        }
      }
      const [x, y] = s.to;
      const ring = prog(t, s.tArrive, s.tArrive + 0.9);
      if (ring > 0 && ring < 1) {
        ctx.strokeStyle = rgba(mixWhite(c, 0.5), 0.9 * (1 - ring)); ctx.lineWidth = 2.5 * (1 - ring) + 0.5;
        ctx.beginPath(); ctx.arc(x, y, 8 + 62 * easeOut(ring), 0, 6.283); ctx.stroke();
      }
      const grow = easeOut((t - s.tArrive + 0.15) / 0.45);
      if (grow > 0) star4(x, y, s.r * grow * (1 + 0.06 * Math.sin(t * 1.7 + s.P.ph1)), c, grow);
    }
    ctx.globalCompositeOperation = "source-over";
    // names under the stars
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const b of starBoxes(t)) {
      if (b.kind !== "starname") continue;
      const s = starOf[b.id], a = smooth(prog(t, s.tArrive, s.tArrive + 0.7));
      ctx.font = b.f;
      ctx.shadowColor = rgba(s.P.rgb, 0.8 * a); ctx.shadowBlur = 12;
      ctx.fillStyle = rgba(mixWhite(s.P.rgb, 0.6), 0.9 * a);
      ctx.fillText(s.P.name, b.tx, b.ty);
      ctx.shadowBlur = 0;
    }
  }

  function drawConstellation(t, L) {
    const ids = CAST.constellation;
    ctx.save();
    const clip = new Path2D();
    clip.rect(0, 0, W, H);
    for (const b of starBoxes(t)) if (b.kind === "starname") clip.rect(b.x + b.w, b.y - 4, -b.w, b.h + 8);
    for (const n of L.names) clip.rect(n.box.x + n.box.w, n.box.y - 4, -n.box.w, n.box.h + 8);
    ctx.clip(clip, "evenodd");
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < ids.length - 1; i++) {
      const t0 = T_END + END.linesStart + i * END.lineEvery;
      const u = smooth((t - t0) / END.lineDraw);
      if (u <= 0) continue;
      const A = starOf[ids[i]], B = starOf[ids[i + 1]];
      const [ax, ay] = A.to, [bx, by] = B.to;
      const d = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / d, uy = (by - ay) / d;
      const ga = A.r * 1.9, gb = B.r * 1.9;
      const sx = ax + ux * ga, sy = ay + uy * ga;
      const L = (d - ga - gb) * u;
      const ex = sx + ux * L, ey = sy + uy * L;
      ctx.strokeStyle = "rgba(255,236,200,0.10)"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,215,0.6)"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      if (u < 1) glowDot(ex, ey, 14, [255, 240, 210], 0.8);
    }
    ctx.restore();
  }

  function wrap(txt, f, maxW) {
    ctx.font = f;
    const out = [];
    for (const sentence of txt.split(/(?<=[.!?])\s+/)) {
      let line = "";
      for (const w of sentence.split(" ")) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      }
      out.push(line);
    }
    return out;
  }

  function textBlock(t) {
    const yT = Math.round(H * 0.75);
    const fT = font(500, 84, F_SERIF), fS = font(400, 42, F_SERIF, "italic");
    const sub = wrap(CAST.text.subtitle, fS, 900);
    return { yT, fT, fS, sub, yRule: yT + 66, ySub: yT + 128 };
  }

  function drawEnding(t) {
    const B = textBlock(t);
    const aT = smooth(prog(t, T_END + END.title, T_END + END.title + 1.4));
    const aR = smooth(prog(t, T_END + END.rule, T_END + END.rule + 0.9));
    const aS = smooth(prog(t, T_END + END.subtitle, T_END + END.subtitle + 1.4));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (aT > 0) {
      ctx.font = B.fT;
      ctx.shadowColor = `rgba(255,220,160,${0.45 * aT})`; ctx.shadowBlur = 24;
      ctx.fillStyle = `rgba(248,238,220,${aT})`;
      ctx.fillText(CAST.text.title, W / 2, B.yT + (1 - aT) * 14);
      ctx.shadowBlur = 0;
    }
    if (aR > 0) {
      const hw = 190 * aR;
      const g = ctx.createLinearGradient(W / 2 - hw, 0, W / 2 + hw, 0);
      g.addColorStop(0, "rgba(248,232,200,0)"); g.addColorStop(0.5, "rgba(248,232,200,0.75)"); g.addColorStop(1, "rgba(248,232,200,0)");
      ctx.fillStyle = g; ctx.fillRect(W / 2 - hw, B.yRule, 2 * hw, 1.5);
    }
    if (aS > 0) {
      ctx.font = B.fS;
      ctx.fillStyle = `rgba(230,224,240,${0.92 * aS})`;
      B.sub.forEach((line, i) => ctx.fillText(line, W / 2, B.ySub + i * 58 + (1 - aS) * 10));
    }
    const k = prog(t, T_END + END.black, T_END + END.black + END.blackFor);
    if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${smooth(k)})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawBirth(t) {
    const u = prog(t, CLOCK.birthAt - 0.1, CLOCK.birthAt + 1.2);
    if (u <= 0 || u >= 1) return;
    const a = Math.sin(Math.PI * u);
    ctx.globalCompositeOperation = "lighter";
    glowDot(me.xAt(0), NOW, 40 + 90 * a, [255, 220, 150], 0.6 * a);
    ctx.globalCompositeOperation = "source-over";
  }

  function drawFrame(t) {
    t = Math.max(0, t);
    const L = layout(t);
    const cam = L.cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    drawBackground(t, cam);
    const axisA = 1 - smooth(prog(t, T_END + END.fadeOld[0], T_END + END.fadeOld[1]));
    drawAxis(t, cam, axisA);
    drawLines(t, cam);
    drawBirth(t);
    drawConstellation(t, L);
    drawStars(t);
    drawHeads(L);
    drawNames(L);
    drawAge(cam, axisA);
    drawEnding(t);
    return L;
  }

  // ---------- inspection hooks for the checks ----------
  window.__lc = {
    W, H, NOW, duration: CLOCK.duration, ageAt, timeOfAge,
    // everything with text or a star, for the layout check
    boxes(t) {
      const L = layout(t), out = [];
      for (const n of L.names) out.push({ kind: "name", id: n.h.P.id, text: n.h.P.name, ...n.box, alpha: n.h.al });
      for (const b of starBoxes(t)) out.push({ ...b, text: b.kind === "starname" ? byId[b.id].name : undefined });
      for (const d of L.dots) out.push({ ...d, kind: "star", text: byId[d.id].name + " (head)" });
      if (t >= T_END + END.title) {
        const B = textBlock(t);
        const wT = textW(CAST.text.title, B.fT);
        out.push({ kind: "text", text: CAST.text.title, x: W / 2 - wT / 2, y: B.yT - 46, w: wT, h: 92 });
        B.sub.forEach((line, i) => {
          const w = textW(line, B.fS);
          out.push({ kind: "text", text: line, x: W / 2 - w / 2, y: B.ySub + i * 58 - 26, w, h: 52 });
        });
      }
      return out;
    },
    draw: drawFrame,
  };

  // ---------- HyperFrames seek protocol ----------
  let lastT = 0, ready = false;
  const fontsReady = Promise.all([
    new FontFace(F_SANS, "url(fonts/inter-latin-600-normal.woff2)", { weight: "600" }).load(),
    new FontFace(F_SANS, "url(fonts/inter-latin-400-normal.woff2)", { weight: "400" }).load(),
    new FontFace(F_SANS, "url(fonts/inter-latin-400-normal.woff2)", { weight: "500" }).load(),
    new FontFace(F_SERIF, "url(fonts/cormorant-garamond-latin-500-normal.woff2)", { weight: "500" }).load(),
    new FontFace(F_SERIF, "url(fonts/cormorant-garamond-latin-400-italic.woff2)", { weight: "400", style: "italic" }).load(),
  ]).then((faces) => {
    faces.forEach((f) => document.fonts.add(f));
    for (const k in widthCache) delete widthCache[k];
    ready = true;
    drawFrame(lastT);
  });
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady["life-constellation"] = fontsReady;

  window.addEventListener("hf-seek", (e) => {
    lastT = e.detail.time;
    drawFrame(lastT);
  });
  window.__lc.ready = () => ready;
  drawFrame(0);
})();
