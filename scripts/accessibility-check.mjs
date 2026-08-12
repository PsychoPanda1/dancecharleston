import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { defaultPaths } from "./event-generator.mjs";

const { outputDir } = defaultPaths();
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let filePath = path.join(outputDir, pathname === "/" ? "index.html" : pathname);
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) filePath = path.join(filePath, "index.html");
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

try {
  for (const pathname of [
    "/",
    "/tango.html",
    "/Swing/",
    "/Salsa-Bachata/",
    "/Ballroom/",
    "/Line-Dancing/",
  ]) {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}${pathname}`, { waitUntil: "domcontentloaded" });
    // Google Calendar is third-party UI we cannot change; audit the site-owned page shell.
    const results = await new AxeBuilder({ page }).exclude("iframe").analyze();
    if (results.violations.length) {
      const details = results.violations
        .map(
          ({ id, impact, description, nodes }) =>
            `${id} (${impact}): ${description}; ${nodes.length} node(s): ${nodes.map(({ target }) => target.join(" ")).join(", ")}`,
        )
        .join("\n");
      throw new Error(`${pathname} has accessibility violations:\n${details}`);
    }
    await page.close();
    console.log(`${pathname} passed automated accessibility checks.`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
