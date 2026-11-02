// The page: works out the island for right now from the real clock, then keeps it running. Browser only.
import { tickAt, msAt, label, sunAt, TICKS_PER_DAY } from "./clock.js";
import { RULES, makeState, step, runTo, cloneState, island, light } from "./sim.js";
import { W, H, SEA, SAND, SOIL, ROCK } from "./island.js";

const $ = (id) => document.getElementById(id);
const canvas = $("isle"), ctx = canvas.getContext("2d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PX = 14; // canvas pixels per tile
canvas.width = W * PX; canvas.height = H * PX;

let live = null, prev = null, hopStart = 0, replay = null, hover = null;

// Colours of the ground, mixed with grass from bare soil to lush.
const C = { sea: [38, 92, 128], deep: [22, 60, 96], sand: [222, 204, 158], soil: [138, 106, 72], lush: [74, 140, 62],
  rock: [128, 124, 118] };
const mix = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));

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
  return `rgba(8,14,40,${Math.min(0.62, 0.3 + (-alt - 2) / 20)})`;
}

function draw(state, prevState, f, now) {
  const tick = state.tick;
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i - x) / W;
    // A little tile-to-tile grain on the land, so it reads as ground and not flat paint.
    const grain = 0.93 + 0.14 * (((i * 2654435761) >>> 0) % 1000) / 1000;
    let c = groundColour(i, state.grass).map((v) => v * grain);
    if (island.tile[i] === SEA) {
      // A slow shimmer, deeper further from the island.
      const deep = Math.min(1, Math.hypot(x - W / 2, (y - H / 2) * 1.6) / (W * 0.55));
      c = mix(C.sea, C.deep, deep);
      const s = reduce ? 0 : Math.sin(now / 1400 + x * 0.6 + y * 0.9) * 6;
      c = c.map((v) => v + s);
    }
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(x * PX, y * PX, PX, PX);
  }
  const lastAt = new Map((prevState ? prevState.grazers : []).map((z) => [z.id, z.at]));
  const up = sunAt(tick) > -3;
  for (const z of state.grazers) {
    const from = lastAt.has(z.id) ? lastAt.get(z.id) : z.at;
    const fx = from % W, fy = Math.floor(from / W), tx = z.at % W, ty = Math.floor(z.at / W);
    const e = Math.min(1, f);
    const hop = up && from !== z.at ? Math.sin(e * Math.PI) * 4 : 0;
    const bob = up && !reduce ? Math.sin(now / 300 + z.id) * 0.8 : 0;
    const cx = (fx + (tx - fx) * e + 0.5) * PX, cy = (fy + (ty - fy) * e + 0.5) * PX - hop - bob;
    const r = z.age < 2 * TICKS_PER_DAY ? 3.5 : 5;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(cx, (fy + (ty - fy) * e + 0.5) * PX + r * 0.8, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = z.energy < 0.3 ? "#cdb9a0" : "#f6ecd8";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2018";
    if (up) { ctx.beginPath(); ctx.arc(cx + r * 0.45, cy - r * 0.2, 1.1, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillRect(cx + r * 0.2, cy - r * 0.2, r * 0.6, 1); }
  }
  const tint = skyTint(tick);
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (sunAt(tick) < -6) { // stars over the water
    ctx.fillStyle = "rgba(255,255,240,0.7)";
    for (let k = 0; k < 70; k++) {
      const sx = (k * 97) % canvas.width, sy = (k * 61 + 13) % canvas.height;
      const i = Math.floor(sy / PX) * W + Math.floor(sx / PX);
      if (island.tile[i] === SEA && (reduce || Math.sin(now / 900 + k) > -0.6)) ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }
  if (hover) {
    const z = state.grazers.find((g) => g.id === hover.id);
    if (z) {
      ctx.strokeStyle = "#fff6d8"; ctx.lineWidth = 1.5;
      ctx.strokeRect((z.at % W) * PX - 2, Math.floor(z.at / W) * PX - 2, PX + 4, PX + 4);
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
  $("green").textContent = `${Math.round(100 * green / soil)}%`;
}

function writeHistory(state) {
  const list = $("history");
  if (list.childElementCount === state.history.length) return;
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

// ---- replay of the last 24 hours ----
function startReplay() {
  if (replay) { stopReplay(); return; }
  const s = runTo(live.tick - TICKS_PER_DAY);
  const frames = [cloneState(s)];
  while (s.tick < live.tick) { step(s); frames.push(cloneState(s)); }
  replay = { frames, k: 0, t0: performance.now() };
  $("replay").textContent = "Back to now";
  $("replay").setAttribute("aria-pressed", "true");
  document.body.classList.add("replaying");
}
function stopReplay() {
  replay = null;
  $("replay").textContent = "Replay the last 24 hours";
  $("replay").setAttribute("aria-pressed", "false");
  document.body.classList.remove("replaying");
}

function frame(now) {
  if (replay) {
    const per = 90; // ms per ten-minute tick: a day in about 13 seconds
    const pos = (now - replay.t0) / per, k = Math.floor(pos);
    if (k >= replay.frames.length - 1) stopReplay();
    else {
      const cur = replay.frames[k + 1], before = replay.frames[k];
      draw(cur, before, pos - k, now);
      describe(cur);
      $("next").textContent = "replay";
      requestAnimationFrame(frame);
      return;
    }
  }
  catchUp();
  draw(live, prev, (now - hopStart) / 1500, now);
  describe(live);
  writeHistory(live);
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointermove", (ev) => {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left) / r.width * W), y = Math.floor((ev.clientY - r.top) / r.height * H);
  const state = replay ? replay.frames[Math.min(replay.frames.length - 1, replay.k)] : live;
  const z = state && state.grazers.find((g) => Math.abs((g.at % W) - x) <= 0 && Math.abs(Math.floor(g.at / W) - y) <= 0);
  hover = z ? { id: z.id } : null;
  const tip = $("tip");
  if (z) {
    const days = Math.floor(z.age / TICKS_PER_DAY);
    tip.textContent = `Grazer #${z.id} · ${days} ${days === 1 ? "day" : "days"} old · ${z.energy > 1.2 ? "well fed" : z.energy > 0.4 ? "peckish" : "starving"}`;
    tip.hidden = false;
    tip.style.left = `${ev.clientX - r.left + 12}px`; tip.style.top = `${ev.clientY - r.top + 12}px`;
  } else tip.hidden = true;
});
canvas.addEventListener("pointerleave", () => { hover = null; $("tip").hidden = true; });
$("replay").addEventListener("click", startReplay);

writeRules();
catchUp();
writeHistory(live);
requestAnimationFrame(frame);
window.__island = { get live() { return live; }, light };
