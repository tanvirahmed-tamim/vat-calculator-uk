// Site standards gate.
//
//   node tools/qa-standards.js
//
// Fails when any page breaks a standing rule:
//   - an em dash, en dash or dash entity anywhere in the repo
//   - a GitHub issue-tracker reference
//   - a missing contact@vatinuk.co.uk on the trust and contact pages
//   - a missing root icon tag
//   - an internal href, canonical, og:url, JSON-LD URL or sitemap loc ending .html
//   - an extensionless internal link with no matching file
//   - malformed JSON-LD or sitemap XML
//   - an American spelling in visible copy

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://vatinuk.co.uk";
const SKIP = new Set([".git", "node_modules", ".github"]);
const TEXT_EXT = new Set([".html", ".js", ".css", ".xml", ".json", ".webmanifest", ".md", ".txt", ".csv", ".svg"]);
const CONTACT_PAGES = ["contact.html", "corrections.html", "editorial-policy.html", "methodology.html"];
const US_SPELLINGS = [
  "color", "colors", "centered", "centering", "favorite", "favorites", "behavior", "behaviors",
  "defense", "offense", "labor", "analyze", "analyzed", "organize", "organized", "organization's",
  "recognize", "recognized", "apologize", "customize", "customized", "prioritize", "prioritized",
  "percent", "traveled", "canceled", "fulfill", "enrollment",
];

const problems = [];
const add = (file, message) => problems.push(`${file}: ${message}`);
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");

function walk(dir, filter) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, filter));
    else if (filter(entry.name)) out.push(abs);
  }
  return out;
}

const pages = walk(ROOT, (name) => name.endsWith(".html")).sort();
const textFiles = walk(ROOT, (name) => TEXT_EXT.has(path.extname(name)) || ["_headers", "_redirects"].includes(name));

/* ------------------------------- dash scan ------------------------------- */

const DASH = /[\u2013\u2014]/;
const DASH_ENTITY = /&(?:mdash|ndash|#8212|#8211);/i;

for (const abs of textFiles) {
  const body = fs.readFileSync(abs, "utf8");
  const characters = (body.match(/[\u2013\u2014]/g) || []).length;
  const entities = (body.match(new RegExp(DASH_ENTITY.source, "gi")) || []).length;
  if (characters) add(rel(abs), `${characters} em or en dash character${characters === 1 ? "" : "s"}`);
  if (entities) add(rel(abs), `${entities} dash entit${entities === 1 ? "y" : "ies"}`);
}

/* ------------------------------ link helpers ----------------------------- */

function resolveInternal(relative, href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return true;
  const fromDir = path.posix.dirname(relative);
  const base = clean.startsWith("/")
    ? clean.replace(/^\//, "")
    : path.posix.normalize(path.posix.join(fromDir === "." ? "" : fromDir, clean));
  const candidates = base === "" ? ["index.html"] : [base, `${base}.html`, path.posix.join(base, "index.html")];
  return candidates.some((candidate) => fs.existsSync(path.join(ROOT, candidate)));
}

function pageUrl(relative) {
  return relative === "index.html" ? `${SITE}/` : `${SITE}/${relative.replace(/\.html$/, "")}`;
}

function internalHrefs(html) {
  return [...html.matchAll(/href="([^"]*)"/g)]
    .map((match) => match[1])
    .filter((href) => href && !href.startsWith("#") && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href));
}

/* ------------------------------- page checks ----------------------------- */

const linked = new Set();

for (const abs of pages) {
  const name = rel(abs);
  const html = fs.readFileSync(abs, "utf8");

  if (/github\.com/i.test(html)) add(name, "GitHub reference");
  if (/issue tracker|bug report/i.test(html)) add(name, "issue-tracker wording");

  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  if (!canonical) add(name, "no canonical");
  else if (/\.html(?:[?#]|$)/i.test(canonical)) add(name, `canonical ends .html: ${canonical}`);
  else if (canonical !== pageUrl(name)) add(name, `canonical ${canonical} expected ${pageUrl(name)}`);

  const ogUrl = (html.match(/<meta property="og:url" content="([^"]*)"/) || [])[1];
  if (!ogUrl) add(name, "no og:url");
  else if (/\.html(?:[?#]|$)/i.test(ogUrl)) add(name, `og:url ends .html: ${ogUrl}`);
  else if (canonical && ogUrl !== canonical) add(name, `og:url ${ogUrl} does not match canonical`);

  for (const icon of [
    '<link rel="icon" href="/favicon.ico"',
    '<link rel="icon" href="/favicon.svg"',
    '<link rel="icon" href="/favicon-192.png"',
    '<link rel="icon" href="/favicon-512.png"',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png"',
    '<link rel="manifest" href="/site.webmanifest"',
  ]) {
    if (!html.includes(icon)) add(name, `missing ${icon.replace(/<link |"/g, "").trim()}`);
  }

  const hrefs = internalHrefs(html);
  for (const href of hrefs) {
    if (/\.html(?:[?#]|$)/i.test(href)) add(name, `internal href ends .html: ${href}`);
    if (!resolveInternal(name, href)) add(name, `unresolved internal href: ${href}`);
    const clean = href.split("#")[0].split("?")[0];
    if (!clean || /^(?:assets|favicon|apple-touch-icon|site\.webmanifest)/.test(clean.replace(/^\.\.?\//, "").replace(/^\//, ""))) continue;
    const fromDir = path.posix.dirname(name);
    const base = clean.startsWith("/")
      ? clean.replace(/^\//, "")
      : path.posix.normalize(path.posix.join(fromDir === "." ? "" : fromDir, clean));
    linked.add("/" + (base === "" ? "" : base.replace(/\.html$/, "")));
  }

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let graph;
    try {
      graph = JSON.parse(match[1]);
    } catch (error) {
      add(name, `JSON-LD parse error: ${error.message}`);
      continue;
    }
    const stack = [graph];
    while (stack.length) {
      const node = stack.pop();
      if (typeof node === "string") {
        if (/^https:\/\/vatinuk\.co\.uk\//.test(node) && /\.html(?:[?#]|$)/i.test(node)) {
          add(name, `JSON-LD URL ends .html: ${node}`);
        }
        continue;
      }
      if (Array.isArray(node)) {
        stack.push(...node);
      } else if (node && typeof node === "object") {
        stack.push(...Object.values(node));
      }
    }
  }

  if (!html.includes("contact@vatinuk.co.uk") && CONTACT_PAGES.includes(name)) {
    add(name, "missing contact@vatinuk.co.uk");
  }

  const visible = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ");
  for (const word of US_SPELLINGS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(visible)) add(name, `American spelling: ${word}`);
  }
}

/* ----------------------------- page coverage ----------------------------- */

const allHtml = pages.map((abs) => fs.readFileSync(abs, "utf8")).join("\n");
if (!allHtml.includes("£") && !allHtml.includes("&pound;")) {
  add("site", "no GBP symbol anywhere in the pages");
}

for (const abs of pages) {
  const name = rel(abs);
  if (name === "404.html") continue;
  const url = "/" + (name === "index.html" ? "" : name.replace(/\.html$/, ""));
  if (url !== "/" && !linked.has(url)) add(name, `no page links to ${url}`);
}

/* -------------------------------- sitemap -------------------------------- */

const sitemapAbs = path.join(ROOT, "sitemap.xml");
const sitemap = fs.readFileSync(sitemapAbs, "utf8");
if (!/^<\?xml /.test(sitemap)) add("sitemap.xml", "missing XML declaration");

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const lastmods = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
if (locs.length !== lastmods.length) add("sitemap.xml", `${locs.length} locs but ${lastmods.length} lastmods`);

const expected = new Set(pages.filter((abs) => rel(abs) !== "404.html").map((abs) => pageUrl(rel(abs))));
for (const loc of locs) {
  if (/\.html(?:[?#]|$)/i.test(loc)) add("sitemap.xml", `loc ends .html: ${loc}`);
  if (!expected.has(loc)) add("sitemap.xml", `loc has no page: ${loc}`);
  expected.delete(loc);
}
for (const missing of expected) add("sitemap.xml", `page missing from sitemap: ${missing}`);

for (const [loc, date] of lastmods.map((match) => [match[1], match[2]])) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) add("sitemap.xml", `bad lastmod on ${loc}: ${date}`);
  if (/\/guides$/.test(loc)) {
    if (date !== "2026-11-25") add("sitemap.xml", `${loc} lastmod ${date} expected 2026-11-25`);
  } else if (/\/guides\/(?:vat-cash-accounting-vs-standard|quoting-inc-vs-ex-vat-prices|vat-on-delivery-postage-packaging)$/.test(loc)) {
    if (date !== "2026-11-21") add("sitemap.xml", `${loc} lastmod ${date} expected 2026-11-21`);
  }
}

/* -------------------------------- redirects ------------------------------ */

const redirects = fs.readFileSync(path.join(ROOT, "_redirects"), "utf8");
for (const line of redirects.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    add("_redirects", `malformed rule: ${trimmed}`);
    continue;
  }
  if (/\.html$/i.test(parts[1])) add("_redirects", `destination ends .html: ${trimmed}`);
  if (!/^30[12]$/.test(parts[2] || "")) add("_redirects", `missing 301 status: ${trimmed}`);
}
const pageRules = redirects.split(/\r?\n/).filter((line) => line.trim().startsWith("/") && line.includes(".html "));
if (pageRules.length < pages.length - 1) {
  add("_redirects", `${pageRules.length} page rules for ${pages.length - 1} pages`);
}

/* -------------------------------- summary -------------------------------- */

if (problems.length) {
  console.log(`problems: ${problems.length}`);
  for (const problem of problems) console.log(` - ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`checked ${pages.length} pages, ${textFiles.length} text files: standards clean`);
}
