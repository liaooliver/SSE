// Builds ../app/static/index.html (SPEC R26): compiles src/input.css with the Tailwind CLI
// (minified) and inlines the CSS into src/index.html. No dependencies beyond package.json.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");
const templatePath = join(here, "src", "index.html");
const outPath = join(here, "..", "app", "static", "index.html");

const PLACEHOLDER = "<!-- @build:inline-css -->";
const DOCTYPE = "<!doctype html>\n";
const NOTICE =
  "<!-- Generated from frontend/ by `npm run build`. Do not edit by hand; edit frontend/src/ instead. -->\n";

function fail(message) {
  console.error(`build failed: ${message}`);
  process.exit(1);
}

// Tailwind CLI writes the CSS to stdout when no -o is given.
let css = execFileSync(process.execPath, [cli, "-i", join("src", "input.css"), "--minify"], {
  cwd: here,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  maxBuffer: 16 * 1024 * 1024,
}).trim();

// R26: no external URLs at all. Keep Tailwind's license banner, minus its URL.
css = css.replace(/^\/\*! tailwindcss (v[\d.]+) \| MIT License \| https:\/\/tailwindcss\.com \*\//,
  "/*! tailwindcss $1 | MIT License */");
if (/https?:/i.test(css)) fail("compiled CSS contains an http(s) URL");
if (/@import|@font-face|url\(/i.test(css)) fail("compiled CSS contains @import, @font-face or url()");
if (/<\/style/i.test(css)) fail("compiled CSS contains </style");

const template = readFileSync(templatePath, "utf8");
if (!template.startsWith(DOCTYPE)) fail("src/index.html must start with <!doctype html>");
const parts = template.split(PLACEHOLDER);
if (parts.length !== 2) fail(`src/index.html must contain ${PLACEHOLDER} exactly once`);

const html = DOCTYPE + NOTICE + parts[0].slice(DOCTYPE.length) + `<style>${css}</style>` + parts[1];
writeFileSync(outPath, html, "utf8");
console.log(`wrote ${outPath} (${Buffer.byteLength(html)} bytes)`);
