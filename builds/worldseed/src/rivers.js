// Rivers: rain falls on every land patch and runs downhill to the sea. Hollows fill up into lakes first.

// A tiny min-heap of [height, index] pairs.
function heap() {
  const a = [];
  const up = (k) => { while (k > 0) { const p = (k - 1) >> 1; if (a[p][0] <= a[k][0]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; } };
  const down = (k) => {
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < a.length && a[l][0] < a[m][0]) m = l;
      if (r < a.length && a[r][0] < a[m][0]) m = r;
      if (m === k) return;
      [a[m], a[k]] = [a[k], a[m]]; k = m;
    }
  };
  return {
    push(x) { a.push(x); up(a.length - 1); },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
    get size() { return a.length; },
  };
}

const EPS = 1e-5;

// "Priority flood": start from every sea patch and spread inland, lowest first. Each land patch drains to the
// patch the flood reached it from, so every drop of rain finds the sea. A hollow gets filled to its rim (a lake).
export function makeRivers(planet, climate) {
  const { grid, elev } = planet;
  const n = grid.n;
  const filled = new Float32Array(n), down = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n), h = heap();
  for (let i = 0; i < n; i++) if (elev[i] < 0) { filled[i] = elev[i]; seen[i] = 1; h.push([elev[i], i]); }
  const order = [];
  while (h.size) {
    const [, i] = h.pop();
    if (elev[i] >= 0) order.push(i);
    for (const j of grid.neighbors(i)) {
      if (seen[j]) continue;
      seen[j] = 1;
      filled[j] = Math.max(elev[j], filled[i] + EPS);
      down[j] = i;
      h.push([filled[j], j]);
    }
  }
  // Add up the water: highest patches first, each passes its water (rain on it plus all from upstream) down.
  const flow = new Float32Array(n);
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    flow[i] += grid.area[i] * (0.2 + (climate ? climate.moist[i] : 0.5));
    if (down[i] >= 0 && elev[down[i]] >= 0) flow[down[i]] += flow[i];
  }
  // The biggest 3% of flows are rivers. Any filled hollow is a lake: the water sits level in it.
  const landFlows = order.map((i) => flow[i]).sort((a, b) => a - b);
  const cut = landFlows[Math.floor(landFlows.length * 0.97)] ?? Infinity;
  const river = new Uint8Array(n), lake = new Uint8Array(n);
  for (const i of order) {
    if (filled[i] - elev[i] > 1e-3) lake[i] = 1;
    else if (flow[i] >= cut) river[i] = 1;
  }
  return { down, flow, filled, river, lake, cut };
}

// Follow the water from patch i to where it leaves the land. Returns the patches passed through.
export function pathToSea(planet, rivers, i) {
  const path = [i];
  while (planet.elev[i] >= 0) {
    i = rivers.down[i];
    if (i < 0) break;
    path.push(i);
    if (path.length > planet.grid.n) throw new Error("water went round in a circle");
  }
  return path;
}
