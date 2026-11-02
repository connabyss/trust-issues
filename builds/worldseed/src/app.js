// The page: wires the world, the globe and the chronicle to the screen. Browser only.
import { makeWorld, YEARS } from "./world.js";
import { makeView, render, pick, project } from "./globe.js";
import { paintYear, lightsAt, encodeHash, decodeHash, yearLabel } from "./view.js";

const $ = (id) => document.getElementById(id);
const els = { globe: $("globe"), marks: $("marks"), word: $("word"), form: $("seed-form"), play: $("play"),
  time: $("time"), year: $("year"), log: $("log"), peoples: $("peoples"), meteor: $("meteor"), share: $("share"),
  status: $("status"), stage: $("stage"), speed: $("speed"), stats: $("stats") };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const st = { world: null, word: "", meteors: [], year: 0, playing: true, speed: 120, lon: 0, view: null, size: 0,
  img: null, map: null, lights: null, turn: -1, cache: new Map(), cities: [], aiming: false, drag: null,
  focus: null, pulse: null, streak: null, shown: 0, last: performance.now(), idleSpin: true };

function busy(text) { els.status.textContent = text; els.status.hidden = !text; }

function build(word, meteors, keepYear) {
  busy(meteors.length ? "The star lands. History rolls new dice…" : "Forming a planet…");
  setTimeout(() => {
    st.world = makeWorld(word, { meteors });
    st.word = word; st.meteors = meteors; st.cache = new Map(); st.turn = -1;
    if (!keepYear) { st.year = 0; st.lon = 0; st.playing = true; }
    els.word.value = word;
    try { history.replaceState(null, "", encodeHash(word, meteors)); } catch { location.hash = encodeHash(word, meteors); }
    resetLog();
    refresh(true);
    busy("");
  }, 30);
}

function resize() {
  const box = els.stage.getBoundingClientRect();
  const css = Math.max(220, Math.floor(Math.min(box.width, box.height)));
  const px = Math.min(640, Math.round(css * Math.min(1.5, devicePixelRatio || 1)));
  for (const c of [els.globe, els.marks]) { c.style.width = c.style.height = css + "px"; }
  els.globe.width = els.globe.height = px;
  els.marks.width = els.marks.height = css * (devicePixelRatio || 1);
  st.view = makeView(px, 18);
  st.size = px;
  st.img = els.globe.getContext("2d").createImageData(px, px);
}

// ---- the chronicle ----
const TAG = { dawn: "First fire", city: "City", war: "War", peace: "Peace", fell: "Taken", plague: "Plague",
  golden: "Golden age", iron: "Iron", sail: "Sails", colony: "Colony", split: "Breakaway", end: "Fallen", meteor: "Meteor" };

function resetLog() { els.log.textContent = ""; st.shown = 0; }

function eventItem(e) {
  const li = document.createElement("li");
  li.className = "ev ev-" + e.kind + (e.kind === "city" ? " minor" : "");
  const P = e.people !== undefined ? st.world.peoples[e.people] : null;
  if (P) li.style.setProperty("--pc", `rgb(${P.color.join(",")})`);
  const b = document.createElement(e.cell !== null && e.cell !== undefined ? "button" : "div");
  b.className = "ev-body";
  if (b.tagName === "BUTTON") { b.type = "button"; b.title = "Show me where"; b.addEventListener("click", () => focusOn(e.cell)); }
  const head = document.createElement("span");
  head.className = "ev-head";
  head.textContent = `${e.year.toLocaleString("en-US")} · ${TAG[e.kind] || e.kind}`;
  const text = document.createElement("span");
  text.className = "ev-text";
  text.textContent = e.text;
  b.append(head, text);
  li.append(b);
  return li;
}

function syncLog() {
  const evs = st.world.events;
  let n = 0;
  while (n < evs.length && evs[n].year <= st.year) n++;
  if (n < st.shown) { resetLog(); }
  const frag = document.createDocumentFragment();
  for (let k = st.shown; k < n; k++) frag.prepend(eventItem(evs[k]));
  els.log.prepend(frag);
  while (els.log.children.length > 240) els.log.lastChild.remove();
  st.shown = n;
}

function syncPeoples() {
  const counts = new Map();
  for (const c of st.cities) counts.set(c.people, (counts.get(c.people) || 0) + 1);
  const owner = st.ownerNow;
  const land = new Map();
  for (let i = 0; i < owner.length; i++) if (owner[i] >= 0) land.set(owner[i], (land.get(owner[i]) || 0) + 1);
  const alive = st.world.peoples.filter((p) => land.has(p.id)).sort((a, b) => land.get(b.id) - land.get(a.id));
  els.peoples.textContent = "";
  for (const p of alive.slice(0, 10)) {
    const li = document.createElement("li");
    li.style.setProperty("--pc", `rgb(${p.color.join(",")})`);
    li.textContent = p.name;
    const s = document.createElement("small");
    s.textContent = ` ${counts.get(p.id) || 0}`;
    s.title = "cities";
    li.append(s);
    els.peoples.append(li);
  }
  if (alive.length > 10) {
    const li = document.createElement("li");
    li.className = "more";
    li.textContent = `+${alive.length - 10} more`;
    els.peoples.append(li);
  }
  els.stats.textContent = `${alive.length} ${alive.length === 1 ? "people" : "peoples"} · ${st.cities.length} cities`;
}

// ---- each year ----
function refresh(force) {
  const turn = Math.floor(st.year / 10);
  if (turn !== st.turn || force) {
    st.turn = turn;
    st.map = paintYear(st.world, st.year, st.cache);
    st.lights = lightsAt(st.world, st.year);
    st.cities = st.world.citiesAt(st.year);
    st.ownerNow = st.world.ownerAt(st.year);
    syncLog();
    syncPeoples();
  }
  els.year.textContent = yearLabel(st.year);
  els.time.value = String(Math.round(st.year));
  els.play.textContent = st.playing ? "Pause" : st.year >= YEARS ? "Again" : "Play";
  els.play.setAttribute("aria-pressed", String(st.playing));
}

function focusOn(cell) {
  const g = st.world.planet.grid;
  st.focus = { from: st.lon, to: g.lon[cell], t: 0 };
  st.pulse = { cell, t: 0 };
}

function drawMarks(dt) {
  const ctx = els.marks.getContext("2d"), dpr = devicePixelRatio || 1, W = els.marks.width;
  ctx.clearRect(0, 0, W, W);
  const k = W / st.size, g = st.world.planet.grid;
  const big = [...st.cities].sort((a, b) => b.pop - a.pop).slice(0, 7).map((c) => c.id);
  ctx.font = `${11 * dpr}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  for (const c of st.cities) {
    const p = project(st.view, g.lat[c.cell], g.lon[c.cell], st.lon);
    if (!p || p.front < 0.12) continue;
    const x = p.x * k, y = p.y * k, r = (1 + 1.8 * Math.min(1, c.pop)) * dpr;
    // Cities sparkle at night and fade to small grey specks in daylight.
    const day = st.view.day[Math.min(st.size - 1, Math.floor(p.y)) * st.size + Math.min(st.size - 1, Math.floor(p.x))];
    ctx.globalAlpha = Math.min(1, p.front * 3) * (1 - 0.6 * Math.min(1, day * 2));
    ctx.fillStyle = day > 0.3 ? "rgba(250,245,235,0.9)" : "rgba(255,226,160,0.95)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (big.includes(c.id) && p.front > 0.35) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const w = ctx.measureText(c.name).width;
      ctx.fillRect(x + 6 * dpr, y - 8 * dpr, w + 8 * dpr, 16 * dpr);
      ctx.fillStyle = "#f4ead2";
      ctx.fillText(c.name, x + 10 * dpr, y);
    }
  }
  ctx.globalAlpha = 1;
  if (st.pulse) {
    st.pulse.t += dt;
    const p = project(st.view, g.lat[st.pulse.cell], g.lon[st.pulse.cell], st.lon);
    if (p) {
      const a = Math.max(0, 1 - st.pulse.t / 2.2);
      ctx.strokeStyle = `rgba(255,240,200,${a})`; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(p.x * k, p.y * k, (8 + 26 * (st.pulse.t % 1.1)) * dpr, 0, Math.PI * 2); ctx.stroke();
    }
    if (st.pulse.t > 2.2) st.pulse = null;
  }
  if (st.streak) {
    st.streak.t += dt;
    const s = st.streak, f = Math.min(1, s.t / 0.7);
    const sx = W * 1.05, sy = -W * 0.05, x = sx + (s.x * k - sx) * f, y = sy + (s.y * k - sy) * f;
    if (f < 1) {
      const grad = ctx.createLinearGradient(sx, sy, x, y);
      grad.addColorStop(0, "rgba(255,180,90,0)"); grad.addColorStop(1, "rgba(255,240,210,1)");
      ctx.strokeStyle = grad; ctx.lineWidth = 3 * dpr;
      ctx.beginPath(); ctx.moveTo(x - (x - sx) * 0.35, y - (y - sy) * 0.35); ctx.lineTo(x, y); ctx.stroke();
    } else {
      const a = Math.max(0, 1 - (s.t - 0.7) / 0.6);
      const rad = ctx.createRadialGradient(x, y, 0, x, y, 70 * dpr);
      rad.addColorStop(0, `rgba(255,250,230,${a})`); rad.addColorStop(1, "rgba(255,160,60,0)");
      ctx.fillStyle = rad; ctx.beginPath(); ctx.arc(x, y, 70 * dpr, 0, Math.PI * 2); ctx.fill();
      if (!s.fired) { s.fired = true; build(st.word, [...st.meteors, s.meteor], true); }
      if (s.t > 1.3) st.streak = null;
    }
  }
}

function frame(now) {
  const dt = Math.min(0.1, (now - st.last) / 1000);
  st.last = now;
  if (st.world) {
    if (st.playing && !st.streak) {
      st.year = Math.min(YEARS, st.year + st.speed * dt);
      if (st.year >= YEARS) st.playing = false;
    }
    if (st.focus) {
      st.focus.t = Math.min(1, st.focus.t + dt / 0.9);
      let d = ((st.focus.to - st.focus.from + 540) % 360) - 180;
      const e = st.focus.t < 0.5 ? 2 * st.focus.t ** 2 : 1 - (-2 * st.focus.t + 2) ** 2 / 2;
      st.lon = st.focus.from + d * e;
      if (st.focus.t >= 1) st.focus = null;
    } else if (!st.drag && st.idleSpin) {
      st.lon += (reduce ? 1.5 : 5) * dt;
    }
    refresh(false);
    render(st.view, st.world.planet.grid, st.map, st.lights, st.lon, st.img.data);
    els.globe.getContext("2d").putImageData(st.img, 0, 0);
    drawMarks(dt);
  }
  requestAnimationFrame(frame);
}

// ---- controls ----
els.form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const w = els.word.value.trim();
  if (w) build(w, [], false);
});
els.play.addEventListener("click", () => {
  if (st.year >= YEARS) st.year = 0;
  st.playing = !st.playing;
  refresh(false);
});
els.time.addEventListener("input", () => { st.year = Number(els.time.value); st.playing = false; refresh(false); });
els.speed.addEventListener("change", () => { st.speed = Number(els.speed.value); });
els.meteor.addEventListener("click", () => {
  st.aiming = !st.aiming;
  els.meteor.setAttribute("aria-pressed", String(st.aiming));
  els.stage.classList.toggle("aiming", st.aiming);
  els.meteor.textContent = st.aiming ? "Click the planet…" : "Drop a meteor";
});
els.share.addEventListener("click", async () => {
  const url = location.href.split("#")[0] + encodeHash(st.word, st.meteors);
  try { await navigator.clipboard.writeText(url); els.share.textContent = "Link copied"; }
  catch { els.share.textContent = "Copy from the address bar"; }
  setTimeout(() => { els.share.textContent = "Copy link"; }, 1800);
});

function stagePoint(ev) {
  const r = els.globe.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * st.size, y: (ev.clientY - r.top) / r.height * st.size };
}
els.marks.addEventListener("pointerdown", (ev) => {
  const p = stagePoint(ev);
  if (st.aiming) {
    const cell = pick(st.view, st.world.planet.grid, p.x, p.y, st.lon);
    if (cell < 0) return;
    st.aiming = false;
    els.stage.classList.remove("aiming");
    els.meteor.setAttribute("aria-pressed", "false");
    els.meteor.textContent = "Drop a meteor";
    const year = Math.max(10, Math.round(st.year / 10) * 10);
    st.streak = { x: p.x, y: p.y, t: reduce ? 0.7 : 0, meteor: { year, cell } };
    return;
  }
  st.drag = { x: ev.clientX, lon: st.lon };
  st.focus = null;
  els.marks.setPointerCapture(ev.pointerId);
});
els.marks.addEventListener("pointermove", (ev) => {
  if (!st.drag) return;
  const r = els.globe.getBoundingClientRect();
  st.lon = st.drag.lon - (ev.clientX - st.drag.x) / (r.width * 0.43) * 57.3;
});
const endDrag = () => { st.drag = null; };
els.marks.addEventListener("pointerup", endDrag);
els.marks.addEventListener("pointercancel", endDrag);
document.addEventListener("keydown", (ev) => {
  if (ev.target === els.word || ev.target === els.time) return;
  if (ev.code === "Space") { ev.preventDefault(); els.play.click(); }
});
addEventListener("resize", () => { resize(); });
addEventListener("hashchange", () => {
  const h = decodeHash(location.hash);
  if (h.word && (h.word !== st.word || encodeHash(h.word, h.meteors) !== encodeHash(st.word, st.meteors))) build(h.word, h.meteors, false);
});

// Stars behind everything, scattered once.
(function stars() {
  const c = $("sky"), ctx = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.6 * r() ** 3})`;
    ctx.fillRect(r() * c.width, r() * c.height, r() < 0.06 ? 2 : 1, r() < 0.06 ? 2 : 1);
  }
})();

els.time.max = String(YEARS);
resize();
const start = decodeHash(location.hash);
build(start.word || "worldseed", start.word ? start.meteors : [], false);
requestAnimationFrame(frame);
