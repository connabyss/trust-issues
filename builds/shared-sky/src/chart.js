// One round chart holding both skies. It's centred halfway between the two spots overhead, so each person's
// sky is a circle on it and the stars you share sit where the circles overlap.
const RAD = Math.PI / 180;
const vec = ({ ra, dec }) => [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const spot = ([x, y, z]) => ({ ra: ((Math.atan2(y, x) / RAD) + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, z))) / RAD });

export function midpoint(a, b) {
  const s = vec(a).map((x, i) => x + vec(b)[i]);
  return Math.hypot(...s) < 1e-9 ? a : spot(unit(s));
}

// A view centred on `center` that reaches `reach` degrees out to the rim. North up, east on the left.
export function view(center, reach) {
  const n = vec(center);
  const pole = Math.abs(n[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
  const E = unit(cross(pole, n));
  const N = cross(n, E);
  const k = Math.tan((reach / 2) * RAD);
  return (ra, dec) => {
    const v = vec({ ra, dec });
    const theta = Math.acos(Math.max(-1, Math.min(1, dot(v, n)))) / RAD;
    if (theta > reach) return null;
    const e = dot(v, E), nn = dot(v, N), h = Math.hypot(e, nn) || 1;
    const r = Math.tan((theta / 2) * RAD) / k;
    return { x: (-r * e) / h, y: (-r * nn) / h };
  };
}

// The edge of someone's sky: every spot 90 degrees from the spot overhead.
export function horizon(zen, steps = 180) {
  const n = vec(zen);
  const pole = Math.abs(n[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
  const E = unit(cross(pole, n)), N = cross(n, E);
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * 2 * Math.PI;
    return spot(E.map((x, j) => x * Math.cos(t) + N[j] * Math.sin(t)));
  });
}

export const COLORS = { a: "#7fb2ff", b: "#ff8fa3", both: "#f4d58d", none: "rgba(200,205,230,0.18)", night: "#0b1026" };

export function drawShared(ctx, cmp, za, zb, size, colors = COLORS) {
  const reach = Math.min(90 + cmp.apart / 2 + 6, 160);
  const place = view(midpoint(za, zb), reach);
  const R = size / 2 - size * 0.02, c = size / 2, s = size / 800;
  const at = (p) => [c + p.x * R, c + p.y * R];

  ctx.save();
  ctx.fillStyle = colors.night;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  for (const [who, zen] of [["a", za], ["b", zb]]) { // each person's horizon
    const pts = horizon(zen).map((h) => place(h.ra, h.dec)).filter(Boolean);
    ctx.strokeStyle = colors[who];
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([6 * s, 6 * s]);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...at(p)) : ctx.moveTo(...at(p))));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const st of cmp.stars) {
    const p = place(st.ra, st.dec);
    if (!p) continue;
    ctx.fillStyle = colors[st.who || "none"];
    ctx.beginPath();
    ctx.arc(...at(p), Math.max(0.6, (5.6 - st.mag) * 0.55) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
