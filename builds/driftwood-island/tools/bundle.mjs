// Pack index.html and every module in src/ into one self-contained page (for sharing as a single file).
// node tools/bundle.mjs OUT.html
import { readFileSync, writeFileSync } from "node:fs";

const order = ["rng", "noise", "clock", "island", "genes", "prowl", "sim", "app"];
let js = "";
for (const name of order) {
  let src = readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8");
  const exported = new Set();
  src = src.replace(/^import \{([^}]+)\} from "\.\/(\w+)\.js";$/gm, (_, names, from) => `const {${names}} = __${from};`);
  src = src.replace(/^export (?:async )?(function|const|let|class) (\w+)(.*)$/gm, (m, kind, id, rest) => {
    exported.add(id);
    // "export const A = 1, B = 2" exports B too: pick up every name declared on the line.
    if (kind === "const" || kind === "let") for (const [, more] of rest.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g)) exported.add(more);
    return m.replace(/^export /, "");
  });
  src = src.replace(/^export \{([^}]+)\};$/gm, (_, names) => { names.split(",").forEach((n) => exported.add(n.trim())); return ""; });
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`${name}.js has an import/export the bundler can't read`);
  js += `const __${name} = (() => {\n${src}\nreturn { ${[...exported].join(", ")} };\n})();\n`;
}
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  .replace('<script type="module" src="./src/app.js"></script>', () => `<script type="module">\n${js}</script>`);
if (page.includes("./src/app.js")) throw new Error("couldn't find the script tag to replace");
writeFileSync(process.argv[2] || "island.html", page);
