// Save the whole island to plain JSON and back, so a command can keep a copy and step on from it instead of
// working everything out from day 0 each time.
import { RULES, makeState } from "./sim.js";

// Which rules made a saved island. A saved copy from a different set of rules is thrown away.
export const RULES_KEY = RULES.map((r) => `${r.id}@${r.since}`).join(",");

export function toJSON(s) {
  return JSON.stringify({ rules: RULES_KEY, ...s, grass: Array.from(s.grass) });
}

export function fromJSON(text) {
  const o = JSON.parse(text);
  if (o.rules !== RULES_KEY) return null;
  delete o.rules;
  return { ...makeState(), ...o, grass: Float32Array.from(o.grass) };
}
