// Flattens the sky dome onto a circle, like lying on your back with your head to the north:
// straight up in the middle, the horizon at the edge, north at the top and east on the LEFT (it's a view of the sky,
// not a map of the ground). Stereographic, so constellation shapes keep their look.
const RAD = Math.PI / 180;

export function project(alt, az, radius) {
  if (alt < 0) return null; // below the horizon: not in this sky
  const r = radius * Math.tan(((90 - alt) / 2) * RAD);
  return { x: -r * Math.sin(az * RAD), y: -r * Math.cos(az * RAD) };
}
