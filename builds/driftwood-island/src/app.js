// The page: works out the island for right now from the real clock, then keeps it running. Browser only.
import { tickAt, msAt, label, sunAt, TICKS_PER_DAY } from "./clock.js";
import { RULES, makeState, step, runTo, cloneState, island, light } from "./sim.js";
import { W, H, SEA, SAND, SOIL, ROCK } from "./island.js";
import { coatColour, awakeAt } from "./genes.js";

const $ = (id) => document.getElementById(id);
const canvas = $("isle"), ctx = canvas.getContext("2d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let live = null, prev = null, hopStart = 0, replay = null, hover = null, whole = false;
const FF_DAYS = 7;
const view = { x: W / 2, y: H / 2, s: 0 }; // what the camera looks at, in tiles, and screen pixels per tile
let drawn = []; // where each grazer was drawn this frame, for hovering

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth || 900;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(w * 0.62 * dpr);
  canvas.style.height = `${Math.round(w * 0.62)}px`;
}
addEventListener("resize", resize);

// Colours of the ground, mixed with grass from bare soil to lush.
const C = { sea: [38, 92, 128], deep: [22, 60, 96], sand: [222, 204, 158], soil: [138, 106, 72], lush: [74, 140, 62],
  rock: [128, 124, 118] };
const mix = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const grainOf = (i) => 0.93 + 0.14 * (((i * 2654435761) >>> 0) % 1000) / 1000;

function groundColour(i, grass) {
  const t = island.tile[i];
  if (t === SEA) return C.sea;
  if (t === SAND) return C.sand;
  if (t === ROCK) return C.rock;
  return mix(C.soil, C.lush, Math.min(1, grass[i] * 1.6));
}

function skyTint(tick) {
  const alt = sunAt(tick);
  if (alt > 8) return null;
  if (alt > -2) return `rgba(255,140,60,${0.22 * (1 - Math.abs(alt - 3) / 6)})`; // dawn and dusk glow
  return `rgba(8,14,40,${Math.min(0.42, 0.25 + (-alt - 2) / 25)})`;
}

// The camera frames the herd (or the whole island when there's no herd, or when asked) and drifts there slowly.
function aim(state) {
  const cw = canvas.width, ch = canvas.height, all = { x: W / 2, y: H / 2, s: Math.min(cw / W, ch / H) };
  if (whole || !state.grazers.length) return all;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const z of state.grazers) { const x = z.at % W, y = Math.floor(z.at / W); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const m = 4, bw = x1 - x0 + 1 + 2 * m, bh = y1 - y0 + 1 + 2 * m;
  const s = Math.max(all.s, Math.min(all.s * 3.2, cw / bw, ch / bh));
  return { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2, s };
}

// Where a grazer stands right now: its tile, a slow amble around inside it, and a walk when it changes tile.
function placeOf(z, from, now, up, f) {
  const fx = from % W, fy = Math.floor(from / W), tx = z.at % W, ty = Math.floor(z.at / W);
  const e = Math.min(1, f), walk = from !== z.at && f < 1;
  let x = fx + (tx - fx) * e + 0.5, y = fy + (ty - fy) * e + 0.5, dir = tx - fx || 0, moving = walk;
  if (up && !reduce) {
    const t = now / 1000, k = z.id * 1.731;
    // Ambling: drift in slow loops, pausing now and then to graze with the head down.
    const pace = 0.5 + 0.5 * Math.sin(t * 0.21 + k * 3);
    const ox = 0.28 * Math.sin(t * 0.13 + k), oy = 0.22 * Math.sin(t * 0.17 + k * 2);
    x += ox; y += oy;
    const vx = 0.28 * 0.13 * Math.cos(t * 0.13 + k);
    if (!walk) { dir = vx; moving = pace > 0.55; }
    return { x, y, dir: dir || 1, moving, grazing: !moving && !walk, t };
  }
  return { x, y, dir: dir || ((z.id % 2) ? 1 : -1), moving, grazing: false, t: now / 1000 };
}

// Before evolution every grazer looks the same; after, its genes show: size, leg length and coat colour.
const PLAIN = { size: 0.5, legs: 0.3, coat: 0.25, night: 0 };
const isUp = (z, alt) => awakeAt(z.g || PLAIN, Math.round(alt * 10) / 10);

function drawGrazer(z, p, sx, sy, u, up) {
  const g = z.g || PLAIN, young = z.age < 2 * TICKS_PER_DAY, thin = z.energy < 0.3;
  const r = u * (young ? 0.62 : 1) * (0.7 + 0.6 * g.size), face = p.dir >= 0 ? 1 : -1, leg = 0.45 + 0.5 * g.legs;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 1.05, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  const coat = coatColour(g.coat), wool = rgb(thin ? mix(coat, [150, 140, 130], 0.4) : coat), dark = "#3a2c22";
  if (!up) { // asleep: curled up, breathing, head tucked in
    const b = 1 + (reduce ? 0 : 0.05 * Math.sin(p.t * 1.6 + z.id));
    ctx.fillStyle = wool;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9 * b, r * 0.62 * b, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgb(mix(coat, [255, 255, 255], 0.15));
    ctx.beginPath(); ctx.arc(face * r * 0.45, r * 0.1, r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath(); ctx.moveTo(face * r * 0.38, r * 0.08); ctx.lineTo(face * r * 0.58, r * 0.08); ctx.stroke();
    if (r > 6 && !reduce) {
      const zt = (p.t * 0.5 + z.id * 0.37) % 3;
      if (zt < 2) {
        ctx.fillStyle = `rgba(240,240,255,${0.8 * (1 - zt / 2)})`;
        ctx.font = `${Math.round(r * 0.8)}px "Martian Mono", monospace`;
        ctx.fillText("z", face * r * 0.6, -r * (0.7 + zt * 0.5));
      }
    }
    ctx.restore();
    return;
  }
  // Legs swing when walking.
  const swing = p.moving && !reduce ? Math.sin(p.t * 9 + z.id) * r * 0.22 : 0;
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.13); ctx.lineCap = "round";
  for (const [lx, s] of [[-0.45, 1], [-0.15, -1], [0.2, 1], [0.48, -1]]) {
    ctx.beginPath(); ctx.moveTo(lx * r, r * 0.25); ctx.lineTo(lx * r + swing * s, r * (0.25 + leg)); ctx.stroke();
  }
  const bob = p.moving && !reduce ? Math.abs(Math.sin(p.t * 9 + z.id)) * r * 0.06 : 0;
  ctx.fillStyle = wool;
  ctx.beginPath(); ctx.ellipse(0, -bob, r * 0.82, r * 0.52, 0, 0, Math.PI * 2); ctx.fill();
  // The head: down in the grass while grazing, up while walking.
  const nib = p.grazing && !reduce ? Math.sin(p.t * 5 + z.id) * r * 0.05 : 0;
  const hx = face * r * 0.78, hy = p.grazing ? r * 0.18 + nib : -r * 0.32 - bob;
  ctx.fillStyle = "#4a3a2e";
  ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.3, r * 0.24, face * (p.grazing ? 0.6 : -0.2), 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - face * r * 0.18, hy - r * 0.18, r * 0.14, r * 0.07, -face * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(hx + face * r * 0.1, hy - r * 0.05, Math.max(0.8, r * 0.06), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function draw(state, prevState, f, now) {
  const cw = canvas.width, ch = canvas.height, tick = state.tick, alt = sunAt(tick), up = alt > -3;
  const goal = aim(state);
  if (!view.s) Object.assign(view, goal);
  const k = reduce ? 1 : 0.025;
  view.x += (goal.x - view.x) * k; view.y += (goal.y - view.y) * k; view.s += (goal.s - view.s) * k;
  const s = view.s, X = (x) => (x - view.x) * s + cw / 2, Y = (y) => (y - view.y) * s + ch / 2;
  const t = now / 1000;
  ctx.fillStyle = rgb(C.deep); ctx.fillRect(0, 0, cw, ch);
  const x0 = Math.max(0, Math.floor(view.x - cw / 2 / s) - 1), x1 = Math.min(W - 1, Math.ceil(view.x + cw / 2 / s) + 1);
  const y0 = Math.max(0, Math.floor(view.y - ch / 2 / s) - 1), y1 = Math.min(H - 1, Math.ceil(view.y + ch / 2 / s) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x, tile = island.tile[i];
      let c;
      if (tile === SEA) {
        const deep = Math.min(1, Math.hypot(x - W / 2, (y - H / 2) * 1.6) / (W * 0.55));
        const sh = reduce ? 0 : Math.sin(t * 0.7 + x * 0.6 + y * 0.9) * 6;
        c = mix(C.sea, C.deep, deep).map((v) => v + sh);
      } else c = groundColour(i, state.grass).map((v) => v * grainOf(i));
      ctx.fillStyle = rgb(c);
      ctx.fillRect(Math.floor(X(x)), Math.floor(Y(y)), Math.ceil(s) + 1, Math.ceil(s) + 1);
      // Tufts of grass that sway, on lush ground, when we're close enough to see them.
      if (tile === SOIL && state.grass[i] > 0.4 && s > 16) {
        ctx.strokeStyle = "rgba(40,90,34,0.55)"; ctx.lineWidth = Math.max(1, s / 22);
        const sway = reduce ? 0 : Math.sin(t * 1.3 + x * 0.8 + y * 0.5) * s * 0.06;
        for (let q = 0; q < 3; q++) {
          const gx = X(x) + s * (0.2 + 0.3 * q + 0.08 * ((i * (q + 3)) % 3)), gy = Y(y) + s * (0.35 + 0.25 * ((i + q) % 3));
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + sway, gy - s * 0.22); ctx.stroke();
        }
      }
      // Foam where the waves meet the beach, washing in and out.
      if (tile === SAND) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (y + dy) * W + x + dx;
          if (island.tile[j] !== SEA) continue;
          const a = reduce ? 0.35 : 0.25 + 0.3 * Math.sin(t * 1.1 + x * 0.7 + y * 0.4);
          const d = (reduce ? 0.12 : 0.08 + 0.08 * Math.sin(t * 1.1 + x * 0.7 + y * 0.4)) * s;
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          if (dx) ctx.fillRect(dx > 0 ? X(x + 1) : X(x) - d, Y(y), d, s);
          else ctx.fillRect(X(x), dy > 0 ? Y(y + 1) : Y(y) - d, s, d);
        }
      }
    }
  }
  // Cloud shadows drifting over the island in daylight.
  if (alt > 2 && !reduce) {
    ctx.fillStyle = "rgba(10,20,30,0.08)";
    for (let c = 0; c < 4; c++) {
      const cx = ((t * 0.35 + c * 23) % (W + 30)) - 15, cy = (c * 13 + 7) % H;
      ctx.beginPath(); ctx.ellipse(X(cx), Y(cy), s * 6, s * 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The grazers.
  const lastAt = new Map((prevState ? prevState.grazers : []).map((g) => [g.id, g.at]));
  const u = Math.max(5, Math.min(32, s * 0.62));
  drawn = [];
  const placed = state.grazers.map((z) => ({ z, up: isUp(z, alt) }))
    .map(({ z, up }) => ({ z, up, p: placeOf(z, lastAt.has(z.id) ? lastAt.get(z.id) : z.at, now, up, f) }));
  placed.sort((a, b) => a.p.y - b.p.y);
  const eyes = [];
  for (const { z, p, up } of placed) {
    const sx = X(p.x), sy = Y(p.y);
    if (sx < -40 || sy < -40 || sx > cw + 40 || sy > ch + 40) continue;
    drawGrazer(z, p, sx, sy, u, up);
    if (up && alt < -3) eyes.push([sx + (p.dir >= 0 ? 1 : -1) * u * 0.8, sy - u * 0.3]);
    drawn.push({ z, sx, sy, r: u });
    if (hover && hover.id === z.id) {
      ctx.strokeStyle = "#fff6d8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, u * 1.4, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Gulls crossing the sky by day.
  if (alt > 4 && !reduce) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(1.2, s / 14);
    for (let g = 0; g < 3; g++) {
      const span = cw + 300, gx = ((t * (40 + g * 12) + g * 500) % span) - 150, gy = ch * (0.15 + 0.22 * g) + Math.sin(t * 0.8 + g) * 12;
      const flap = Math.sin(t * 7 + g * 2) * 5, w = 8 + s * 0.2;
      ctx.beginPath(); ctx.moveTo(gx - w, gy - flap); ctx.quadraticCurveTo(gx - w / 2, gy - 6, gx, gy);
      ctx.quadraticCurveTo(gx + w / 2, gy - 6, gx + w, gy - flap); ctx.stroke();
    }
  }
  const tint = skyTint(tick);
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, cw, ch); }
  // Night grazers' eyes catch the starlight.
  ctx.fillStyle = "rgba(255,236,150,0.95)";
  for (const [ex, ey] of eyes) { ctx.beginPath(); ctx.arc(ex, ey, Math.max(1.3, u * 0.09), 0, Math.PI * 2); ctx.fill(); }
  if (alt < -6) {
    // Stars over the water, and fireflies drifting over the grass.
    for (let q = 0; q < 90; q++) {
      const sx = (q * 97.3) % cw, sy = (q * 61.7 + 13) % ch;
      const wx = Math.floor((sx - cw / 2) / s + view.x), wy = Math.floor((sy - ch / 2) / s + view.y);
      const onSea = wx < 0 || wy < 0 || wx >= W || wy >= H || island.tile[wy * W + wx] === SEA;
      if (onSea && (reduce || Math.sin(t * 1.1 + q) > -0.5)) { ctx.fillStyle = "rgba(255,255,240,0.7)"; ctx.fillRect(sx, sy, 1.5, 1.5); }
    }
    if (!reduce) {
      for (let q = 0; q < 140; q++) {
        const fx = (q * 37.7) % W + Math.sin(t * 0.3 + q) * 1.5, fy = (q * 23.3) % H + Math.cos(t * 0.27 + q * 2) * 1.2;
        const i = Math.floor(fy) * W + Math.floor(fx);
        if (i < 0 || i >= W * H || state.grass[i] < 0.3) continue;
        const glow = Math.max(0, Math.sin(t * 1.7 + q * 1.3));
        if (glow < 0.2) continue;
        ctx.fillStyle = `rgba(230,255,140,${glow})`;
        ctx.beginPath(); ctx.arc(X(fx), Y(fy), Math.max(1.2, s * 0.07), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function describe(state) {
  const tick = state.tick, alt = sunAt(tick);
  const soil = island.tile.filter((t) => t === SOIL).length;
  const green = state.grass.filter((g) => g > 0.25).length;
  const part = alt > 6 ? "day" : alt > -6 ? (label(tick).endsWith("am") ? "dawn" : "dusk") : "night";
  $("clock").textContent = label(tick);
  $("phase").textContent = part;
  $("count").textContent = String(state.grazers.length);
  const nk = state.kinds.filter((k) => k.named && k.count > 0).length;
  $("nkinds").textContent = String(nk);
  $("nkinds-word").textContent = nk === 1 ? "kind" : "kinds";
  $("green").textContent = `${Math.round(100 * green / soil)}%`;
}

function writeHistory(state) {
  const list = $("history");
  const key = state.history.length + ":" + (state.history.at(-1) || {}).tick;
  if (list.dataset.key === key) return;
  list.dataset.key = key;
  list.textContent = "";
  for (const e of [...state.history].reverse()) {
    const li = document.createElement("li");
    const t = document.createElement("span");
    t.className = "when";
    t.textContent = label(e.tick);
    li.append(t, document.createTextNode(e.text));
    list.append(li);
  }
}

// Every kind that has ever had a name: its colour, how many are alive, where it came from.
function writeKinds(state) {
  const list = $("kinds"), named = state.kinds.filter((k) => k.named);
  const key = named.map((k) => k.id + "." + k.count + "." + k.gone).join();
  if (list.dataset.key === key) return;
  list.dataset.key = key;
  list.textContent = "";
  $("kinds-none").hidden = named.length > 0;
  const order = [...named].sort((a, b) => (a.gone !== null) - (b.gone !== null) || b.count - a.count);
  for (const k of order) {
    const li = document.createElement("li");
    if (k.gone !== null) li.className = "gone";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = rgb(coatColour(k.g.coat));
    dot.style.width = dot.style.height = `${Math.round(10 + 8 * k.g.size)}px`;
    const name = document.createElement("b");
    name.textContent = k.name;
    const t = document.createElement("span");
    t.className = "when";
    const parent = k.parent ? state.kinds[k.parent - 1] : null;
    t.textContent = (k.gone !== null ? `died out ${label(k.gone)}` : `${k.count} alive`) +
      (parent ? ` · split from the ${parent.name}s` : " · the first kind");
    li.append(dot, name, t);
    list.append(li);
  }
}

function writeRules() {
  const ul = $("rules");
  for (const r of RULES) {
    const li = document.createElement("li");
    const t = document.createElement("span");
    t.className = "when";
    t.textContent = "From " + label(r.since);
    li.append(t, document.createTextNode(r.what));
    ul.append(li);
  }
}

// ---- live ----
function catchUp() {
  const target = tickAt(Date.now());
  if (!live) { live = runTo(target - 1); prev = cloneState(live); step(live); hopStart = performance.now(); }
  while (live.tick < target) { prev = cloneState(live); step(live); hopStart = performance.now(); }
  const next = msAt(live.tick + 1) - Date.now();
  $("next").textContent = `${Math.floor(next / 60000)}:${String(Math.floor(next / 1000) % 60).padStart(2, "0")}`;
}

// ---- replay of the last 24 hours, and the fast-forward into the next three days ----
// Both play saved moments one after another; the fast-forward works its moments out as it goes.
function play(mode) {
  const was = replay && replay.mode;
  stopReplay();
  if (was === mode) return;
  const start = mode === "replay" ? runTo(live.tick - TICKS_PER_DAY) : cloneState(live);
  const end = mode === "replay" ? live.tick : live.tick + FF_DAYS * TICKS_PER_DAY;
  replay = { mode, frames: [cloneState(start)], work: start, end, k: 0, t0: performance.now(), per: mode === "replay" ? 90 : 25 }; // a day in 13 s; the week ahead in about 25 s
  $(mode).textContent = "Back to now";
  $(mode).setAttribute("aria-pressed", "true");
  document.body.classList.add(mode === "replay" ? "replaying" : "previewing");
}
function stopReplay() {
  replay = null;
  $("replay").textContent = "Replay the last 24 hours";
  $("ff").textContent = "Fast-forward a week";
  for (const id of ["replay", "ff"]) $(id).setAttribute("aria-pressed", "false");
  document.body.classList.remove("replaying", "previewing");
}

let shown = null; // the moment on screen (live, or a replay/fast-forward frame)

function frame(now) {
  if (replay) {
    const pos = (now - replay.t0) / replay.per, k = Math.floor(pos);
    while (replay.frames.length < k + 2 && replay.work.tick < replay.end) { step(replay.work); replay.frames.push(cloneState(replay.work)); }
    if (replay.frames.length > k + 2) replay.frames[k - 1] = null; // let old moments go
    if (k >= replay.frames.length - 1) stopReplay();
    else {
      const cur = replay.frames[k + 1], before = replay.frames[k];
      shown = cur;
      draw(cur, before, pos - k, now);
      describe(cur);
      writeHistory(cur);
      writeKinds(cur);
      $("next").textContent = replay.mode === "replay" ? "replay" : "preview";
      requestAnimationFrame(frame);
      return;
    }
  }
  catchUp();
  shown = live;
  draw(live, prev, (now - hopStart) / 2500, now);
  describe(live);
  writeHistory(live);
  writeKinds(live);
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointermove", (ev) => {
  const r = canvas.getBoundingClientRect(), kx = canvas.width / r.width;
  const mx = (ev.clientX - r.left) * kx, my = (ev.clientY - r.top) * kx;
  let best = null, bd = Infinity;
  for (const d of drawn) { const dd = Math.hypot(d.sx - mx, d.sy - my); if (dd < Math.max(14, d.r * 1.6) && dd < bd) { bd = dd; best = d; } }
  hover = best ? { id: best.z.id } : null;
  const tip = $("tip");
  if (best) {
    const z = best.z, days = Math.floor(z.age / TICKS_PER_DAY);
    const kind = z.kind && shown.kinds[z.kind - 1], fed = z.energy > 1.2 ? "well fed" : z.energy > 0.4 ? "peckish" : "starving";
    const habit = !z.g ? "" : z.g.night > 0.8 ? " · sleeps by day" : z.g.night > 0.5 ? " · up day and night" : z.g.night > 0.25 ? " · up late" : "";
    tip.textContent = `Grazer #${z.id}${kind && kind.named ? ", a " + kind.name : ""} · ${days} ${days === 1 ? "day" : "days"} old · ${fed}${habit}`;
    tip.hidden = false;
    tip.style.left = `${ev.clientX - r.left + 12}px`; tip.style.top = `${ev.clientY - r.top + 12}px`;
  } else tip.hidden = true;
});
canvas.addEventListener("pointerleave", () => { hover = null; $("tip").hidden = true; });
$("replay").addEventListener("click", () => play("replay"));
$("ff").addEventListener("click", () => play("ff"));
$("whole").addEventListener("click", () => {
  whole = !whole;
  $("whole").setAttribute("aria-pressed", String(whole));
  $("whole").textContent = whole ? "Follow the herd" : "Whole island";
});

resize();
writeRules();
catchUp();
writeHistory(live);
requestAnimationFrame(frame);
window.__island = { get live() { return live; }, get shown() { return shown; }, light };
