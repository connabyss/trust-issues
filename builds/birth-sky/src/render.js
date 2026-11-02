// Draws a sky (from skyAt) onto a 2D canvas context, as a round poster chart.
export const INK = { night: "#0b1026", line: "rgba(160,185,255,0.35)", star: "#fdfcf5", label: "#c9d4ff", rim: "#e9d8a6" };

export function starSize(mag, scale) {
  return Math.max(0.5, (5.6 - mag) * 0.55) * scale; // bright stars big, faint ones small
}

export function drawSky(ctx, sky, size, ink = INK) {
  const R = size / 2 - size * 0.02;
  const c = size / 2;
  const at = (p) => [c + p.x * R, c + p.y * R];
  const scale = size / 800;

  ctx.save();
  ctx.fillStyle = ink.night;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();

  ctx.strokeStyle = ink.line;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  for (const [a, b] of sky.lines) {
    ctx.moveTo(...at(a));
    ctx.lineTo(...at(b));
  }
  ctx.stroke();

  ctx.fillStyle = ink.star;
  for (const s of sky.stars) {
    ctx.beginPath();
    ctx.arc(...at(s), starSize(s.mag, scale), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = ink.label;
  ctx.font = `${Math.round(13 * scale)}px Georgia, serif`;
  for (const n of sky.named) {
    const [x, y] = at(n);
    ctx.fillText(n.name, x + 6 * scale, y - 6 * scale);
  }

  if (sky.moon) drawMoon(ctx, ...at(sky.moon), 14 * scale, sky.moon.lit, sky.moon.waxing, ink);
  ctx.restore();

  ctx.strokeStyle = ink.rim;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();
}

// The lit part of the moon: a half disc plus an ellipse that grows from new to full.
export function drawMoon(ctx, x, y, r, lit, waxing, ink = INK) {
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const side = waxing ? 1 : -1; // in the northern sky a waxing moon is lit on the right
  const k = 2 * lit - 1; // -1 new, 0 half, 1 full
  ctx.fillStyle = ink.star;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, side < 0);
  ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) !== (side > 0));
  ctx.fill();
}
