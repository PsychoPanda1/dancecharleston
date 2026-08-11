import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { defaultPaths, SITE_URL } from "./event-generator.mjs";

const { outputDir } = defaultPaths();

async function mustExist(relativePath) {
  await access(path.join(outputDir, relativePath));
}

for (const requiredPath of [
  "index.html",
  "tango.html",
  "styles.css",
  "script.js",
  "robots.txt",
  "CNAME",
  "events/index.html",
  "events/manifest.json",
  "sitemap.xml",
  "assets/dancecharleston-social.jpg",
]) {
  await mustExist(requiredPath);
}

for (const forbiddenPath of ["dashboard", "node_modules", "scripts", "test", "package.json"]) {
  await assert.rejects(access(path.join(outputDir, forbiddenPath)), undefined, `${forbiddenPath} must not be deployed`);
}

const cname = (await readFile(path.join(outputDir, "CNAME"), "utf8")).trim();
assert.equal(cname, "dancecharleston.com");

const home = await readFile(path.join(outputDir, "index.html"), "utf8");
const tango = await readFile(path.join(outputDir, "tango.html"), "utf8");
assert.ok(home.includes("info%40dancecharleston.com"), "main calendar embed changed unexpectedly");
assert.ok(tango.includes("c_4c505db2b59a8993633fcaba1fb116ad84b21e38d154a69b62c90276b96467bf"));
assert.ok(home.includes('href="/events/"'), "home page must link to generated event pages");
assert.ok(tango.includes('href="/events/"'), "Tango page must link to generated event pages");

const manifest = JSON.parse(await readFile(path.join(outputDir, "events", "manifest.json"), "utf8"));
assert.ok(manifest.eventCount > 0, "event manifest must not be empty");
assert.equal(manifest.events.length, manifest.eventCount);
assert.equal(new Set(manifest.events.map(({ slug }) => slug)).size, manifest.eventCount, "event slugs must be unique");

const sitemap = await readFile(path.join(outputDir, "sitemap.xml"), "utf8");
assert.ok(sitemap.includes(`<loc>${SITE_URL}/events/</loc>`));

for (const event of manifest.events) {
  const relativePath = path.join("events", event.slug, "index.html");
  const html = await readFile(path.join(outputDir, relativePath), "utf8");
  const canonical = `${SITE_URL}/events/${event.slug}/`;
  const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);

  assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`), `${event.slug} canonical mismatch`);
  assert.ok(html.includes(event.title.replaceAll("&", "&amp;")) || html.includes(event.title), `${event.slug} title missing`);
  assert.ok(jsonMatch, `${event.slug} JSON-LD missing`);

  const data = JSON.parse(jsonMatch[1]);
  assert.equal(data["@type"], "Event", `${event.slug} schema type mismatch`);
  assert.ok(data.name, `${event.slug} schema name missing`);
  assert.ok(data.startDate, `${event.slug} schema startDate missing`);
  assert.ok(data.location?.name, `${event.slug} schema location missing`);
  assert.equal(data.url, canonical, `${event.slug} schema URL mismatch`);
  assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `${event.slug} missing from sitemap`);
}

const eventDirectories = (await readdir(path.join(outputDir, "events"), { withFileTypes: true })).filter((entry) => entry.isDirectory());
assert.equal(eventDirectories.length, manifest.eventCount, "generated directory count differs from manifest");

console.log(`Validated ${manifest.eventCount} generated event pages with required SEO fields.`);
