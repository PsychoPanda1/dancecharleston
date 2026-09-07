import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DANCE_STYLES = [
  { path: "Swing", name: "Swing", description: "Swing dances, Lindy Hop lessons, shag and community socials around Charleston.", pattern: /\b(swing|lindy|shag|balboa|jitterbug)\b/i },
  { path: "Salsa-Bachata", name: "Salsa & Bachata", description: "Salsa, bachata and Latin dance nights around Charleston.", pattern: /\b(salsa|bachata|neon latin|latin social|latin night|latin dance|latin american festival)\b/i },
  { path: "Ballroom", name: "Ballroom", description: "Ballroom lessons, social dance parties and competitions around Charleston.", pattern: /\b(ballroom|foxtrot|waltz|rumba|cha[ -]?cha|quickstep|paso doble|samba|hustle)\b/i },
  { path: "Line-Dancing", name: "Line Dancing", description: "Line dancing and country two-step lessons and socials around Charleston.", pattern: /\b(line danc\w*|2steppin\w*|two[ -]?step\w*|2[ -]?step\w*)\b/i },
];

export function matchesStyle(event, style) {
  // A venue is not a dance style: a swing or tango class held at Ballroom
  // Dance Charleston should not automatically become a ballroom listing.
  const title = String(event.title ?? "").replace(/ballroom dance charleston/gi, "").normalize("NFKC");
  if (style.pattern.test(title)) return true;
  if (DANCE_STYLES.some(other => other.pattern.test(title)) || /\b(tango|milonga|contra)\b/i.test(title)) return false;
  const introduction = String(event.description ?? "").split(/\n/)[0].replace(/ballroom dance charleston/gi, "");
  return style.pattern.test(introduction) || (style.path === "Ballroom" && /dance party/i.test(title) && /ballroom dance charleston/i.test(event.location ?? ""));
}

export function renderStyleEvents(events, style, renderCard) {
  const matching = events.filter(event => matchesStyle(event, style));
  const content = matching.length
    ? '<div class="event-grid">' + matching.map(renderCard).join("\n") + '</div>'
    : '<div class="event-empty"><p>No upcoming dates are listed for this style right now. Browse the full calendar or submit a public event below.</p></div>';
  return '<section class="event-month" id="style-events" aria-labelledby="style-events-title" data-style="' + style.path + '" data-event-count="' + matching.length + '"><h2 id="style-events-title">Upcoming events</h2>' + content + '</section>';
}

export async function renderStylePages({ rootDir, outputDir, events, renderCard }) {
  for (const style of DANCE_STYLES) {
    const template = await readFile(path.join(rootDir, style.path, "index.html"), "utf8");
    if (!template.includes("<!-- STYLE_EVENTS -->")) throw new Error(style.path + ": style event template marker missing");
    const html = template.replace("<!-- STYLE_EVENTS -->", renderStyleEvents(events, style, renderCard));
    await writeFile(path.join(outputDir, style.path, "index.html"), html, "utf8");
  }
}
