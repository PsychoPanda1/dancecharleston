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
  "sw.js",
  "offline.html",
  "robots.txt",
  "404.html",
  "site.webmanifest",
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
const notFound = await readFile(path.join(outputDir, "404.html"), "utf8");
const offline = await readFile(path.join(outputDir, "offline.html"), "utf8");
const serviceWorker = await readFile(path.join(outputDir, "sw.js"), "utf8");
const eventIndex = await readFile(path.join(outputDir, "events", "index.html"), "utf8");
assert.ok(home.includes("info%40dancecharleston.com"), "main calendar embed changed unexpectedly");
assert.ok(tango.includes("c_4c505db2b59a8993633fcaba1fb116ad84b21e38d154a69b62c90276b96467bf"));
assert.ok(
  tango.includes("https://www.facebook.com/share/g/1HA3ByyHaN/?mibextid=wwXIfr"),
  "CATS Facebook group link changed unexpectedly",
);
assert.ok(home.includes('class="brand-logo"'), "main page must use the Dance Charleston logo");
assert.ok(tango.includes('class="brand-logo"'), "Tango page must use the Dance Charleston logo");
assert.ok(!tango.includes('class="community-panel"'), "CATS community panel must not push the calendar down");
assert.ok(tango.includes("social-icon-link--whatsapp"), "CATS WhatsApp icon link missing");
assert.ok(tango.includes("social-icon-link--facebook"), "CATS Facebook icon link missing");
assert.ok(home.includes("social-icon-link--install"), "home page install icon missing");
assert.ok(tango.includes("social-icon-link--install"), "Tango page install icon missing");
assert.ok(home.includes("social-icon-link--share"), "home page share icon missing");
assert.ok(tango.includes("social-icon-link--share"), "Tango page share icon missing");
assert.ok(home.includes("data-install-dialog"), "home page install instructions missing");
assert.ok(tango.includes("data-install-dialog"), "Tango page install instructions missing");
assert.ok(tango.includes("/assets/cats-tango-social.png"), "Tango-specific social preview missing");
assert.ok(home.includes('rel="manifest" href="/site.webmanifest"'), "home page manifest link missing");
assert.ok(tango.includes('rel="manifest" href="/site.webmanifest"'), "Tango page manifest link missing");
assert.ok(notFound.includes('href="/"'), "404 page must link back to all events");
assert.ok(notFound.includes('href="/tango.html"'), "404 page must link to Tango events");
assert.ok(offline.includes("Reconnect to load the latest Charleston dance events"), "offline guidance missing");
assert.ok(serviceWorker.includes('caches.match("/offline.html")'), "service worker offline fallback missing");
assert.ok(
  tango.includes("https://chat.whatsapp.com/IjOchhZwt21GPp6twkI9gK?s=cl&amp;p=a&amp;ilr=4"),
  "CATS WhatsApp group link changed unexpectedly",
);
assert.ok(home.includes('href="/events/"'), "home page must link to generated event pages");
assert.ok(tango.includes('href="/events/"'), "Tango page must link to generated event pages");
assert.ok(home.includes("Browse upcoming event details."), "home page event-details link text changed unexpectedly");
assert.ok(tango.includes("Browse upcoming event details."), "Tango page event-details link text changed unexpectedly");

for (const [pageName, html] of [
  ["home", home],
  ["Tango", tango],
  ["event index", eventIndex],
]) {
  const menu = html.match(/<div class="calendar-menu-list">(.*?)<\/div>/s)?.[1];
  assert.ok(menu, `${pageName} calendar menu missing`);
  assert.ok(!menu.includes('href="/events/"'), `${pageName} calendar menu must not include Event pages`);
}

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
