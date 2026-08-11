import { generateSite, defaultPaths } from "./event-generator.mjs";

const { rootDir, outputDir } = defaultPaths();
const now = process.env.BUILD_NOW ? new Date(process.env.BUILD_NOW) : new Date();

if (Number.isNaN(now.getTime())) {
  throw new Error("BUILD_NOW must be a valid ISO-8601 date when provided");
}

const events = await generateSite({ rootDir, outputDir, now });
console.log(`Generated ${events.length} event pages in ${outputDir}`);
