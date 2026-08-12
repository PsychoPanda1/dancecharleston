import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ical from "node-ical";

export const SITE_URL = "https://dancecharleston.com";
export const TIME_ZONE = "America/New_York";
export const EVENT_WINDOW_DAYS = 60;

export const CALENDARS = [
  {
    key: "all",
    name: "Dance Charleston",
    label: "All events",
    feedUrl:
      "https://calendar.google.com/calendar/ical/info%40dancecharleston.com/public/basic.ics",
    calendarUrl: "/",
    formUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSdtve1qHMu8uiXk-7clxj9_CTjhGLVZBG0jekx14N9eMEXDKA/viewform?usp=publish-editor",
  },
  {
    key: "tango",
    name: "CATS Tango",
    label: "Tango events",
    feedUrl:
      "https://calendar.google.com/calendar/ical/c_4c505db2b59a8993633fcaba1fb116ad84b21e38d154a69b62c90276b96467bf%40group.calendar.google.com/public/basic.ics",
    calendarUrl: "/tango.html",
    formUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSf4A45UAccYHl8zE7hgY9HkON56QdYxswsVDllp-YPc1j0K_A/viewform?usp=dialog",
  },
];

const STATIC_PATHS = [
  "index.html",
  "tango.html",
  "404.html",
  "styles.css",
  "script.js",
  "sw.js",
  "offline.html",
  "site.webmanifest",
  "robots.txt",
  "CNAME",
  "assets",
];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "dance-event";
}

function textValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value.val === "string") {
    return value.val.trim();
  }

  return "";
}

export function htmlToText(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function organizerName(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.replace(/^mailto:/i, "").trim();
  }

  return String(value.params?.CN || value.name || value.val || "")
    .replace(/^mailto:/i, "")
    .trim();
}

export function extractSourceUrl(description = "", explicitUrl = "") {
  const candidates = [textValue(explicitUrl)];
  const matches = textValue(description).match(/https?:\/\/[^\s<>"']+/gi) || [];
  candidates.push(...matches);

  for (const candidate of candidates) {
    const cleaned = candidate.replace(/[),.;!?]+$/, "");

    try {
      const url = new URL(cleaned);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.href;
      }
    } catch {
      // Ignore malformed optional source URLs.
    }
  }

  return "";
}

function zonedParts(date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
}

export function localDateKey(date, timeZone = TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function structuredDate(date, isFullDay = false, timeZone = TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  const datePart = `${parts.year}-${parts.month}-${parts.day}`;

  if (isFullDay) {
    return datePart;
  }

  const offset = parts.timeZoneName.replace("GMT", "") || "+00:00";
  return `${datePart}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

export function displayDate(event, timeZone = TIME_ZONE) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (event.isFullDay) {
    return dateFormatter.format(event.start);
  }

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const startDate = dateFormatter.format(event.start);
  const startTime = timeFormatter.format(event.start);

  if (!event.end) {
    return `${startDate} at ${startTime}`;
  }

  const sameDay = localDateKey(event.start, timeZone) === localDateKey(event.end, timeZone);
  const endTime = timeFormatter.format(event.end);
  return sameDay
    ? `${startDate}, ${startTime}–${endTime}`
    : `${startDate}, ${startTime}–${dateFormatter.format(event.end)}, ${endTime}`;
}

function eventStatus(status) {
  return String(status || "").toUpperCase() === "CANCELLED"
    ? "https://schema.org/EventCancelled"
    : "https://schema.org/EventScheduled";
}

function richerValue(first, second) {
  return String(second || "").length > String(first || "").length ? second : first;
}

export function normalizeInstance(instance, calendar) {
  const sourceEvent = instance.event || instance;
  const title = textValue(instance.summary || sourceEvent.summary);
  const location = textValue(sourceEvent.location);
  const description = htmlToText(textValue(sourceEvent.description));
  const start = new Date(instance.start || sourceEvent.start);
  const endValue = instance.end || sourceEvent.end;
  const end = endValue ? new Date(endValue) : null;
  const isFullDay = Boolean(
    instance.isFullDay || sourceEvent.datetype === "date" || sourceEvent.start?.dateOnly,
  );
  const uid = textValue(sourceEvent.uid) || `${title}|${start.toISOString()}`;
  const instanceId = createHash("sha1")
    .update(`${uid}|${start.toISOString()}`)
    .digest("hex")
    .slice(0, 8);
  const slug = `${localDateKey(start)}-${slugify(title)}-${instanceId}`;

  return {
    id: instanceId,
    uid,
    slug,
    title,
    start,
    end,
    isFullDay,
    location,
    description,
    organizer: organizerName(sourceEvent.organizer),
    sourceUrl: extractSourceUrl(description, sourceEvent.url),
    status: eventStatus(sourceEvent.status),
    calendarKeys: [calendar.key],
  };
}

export function expandCalendarData(parsedCalendar, calendar, range) {
  const events = [];

  for (const item of Object.values(parsedCalendar)) {
    if (!item || item.type !== "VEVENT") {
      continue;
    }

    const instances = ical.expandRecurringEvent(item, {
      from: range.from,
      to: range.to,
      includeOverrides: true,
      excludeExdates: true,
      expandOngoing: true,
    });

    for (const instance of instances) {
      const normalized = normalizeInstance(instance, calendar);
      if (normalized.title && normalized.location && normalized.start >= range.from) {
        events.push(normalized);
      }
    }
  }

  return events;
}

export function deduplicateEvents(events) {
  const byFingerprint = new Map();

  for (const event of events) {
    const fingerprint = [
      event.title.toLowerCase().replace(/\W+/g, ""),
      event.location.toLowerCase().replace(/\W+/g, ""),
      event.start.toISOString(),
    ].join("|");
    const existing = byFingerprint.get(fingerprint);

    if (!existing) {
      byFingerprint.set(fingerprint, { ...event });
      continue;
    }

    existing.calendarKeys = [...new Set([...existing.calendarKeys, ...event.calendarKeys])];
    existing.description = richerValue(existing.description, event.description);
    existing.organizer = richerValue(existing.organizer, event.organizer);
    existing.sourceUrl = existing.sourceUrl || event.sourceUrl;
    existing.end = existing.end || event.end;
    existing.status =
      existing.status === "https://schema.org/EventCancelled" ||
      event.status === "https://schema.org/EventCancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled";
  }

  return [...byFingerprint.values()].sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

function eventDescription(event) {
  if (event.description) {
    return event.description.replace(/\s+/g, " ").trim().slice(0, 300);
  }

  return `${event.title} at ${event.location} in the Charleston area.`;
}

function calendarLinks(event) {
  return event.calendarKeys
    .map((key) => CALENDARS.find((calendar) => calendar.key === key))
    .filter(Boolean);
}

function jsonLdForEvent(event, pageUrl) {
  const venueParts = event.location.split(",").map((part) => part.trim()).filter(Boolean);
  const data = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: structuredDate(event.start, event.isFullDay),
    eventStatus: event.status,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: venueParts[0] || event.location,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.location,
      },
    },
    description: eventDescription(event),
    image: [`${SITE_URL}/assets/dancecharleston-social.jpg`],
    url: pageUrl,
  };

  if (event.end) {
    data.endDate = structuredDate(event.end, event.isFullDay);
  }

  if (event.organizer) {
    data.organizer = {
      "@type": "Organization",
      name: event.organizer,
    };
  }

  return data;
}

function renderDescription(description) {
  if (!description) {
    return "";
  }

  return `<section class="event-description" aria-labelledby="event-description-title">
          <h2 id="event-description-title">Event details</h2>
          <p>${escapeHtml(description).replaceAll("\n", "<br>")}</p>
        </section>`;
}

function renderHeader() {
  return `<header class="site-header">
      <div class="header-content">
        <a class="brand" href="/" aria-label="Dance Charleston home">
          <img class="brand-logo" src="/assets/dancecharleston-icon.jpg" alt="" width="68" height="46">
          <span>Dance Charleston</span>
        </a>
        <div class="header-actions">
          <p class="tagline">Find your next dance in Charleston, South Carolina.</p>
          <nav class="calendar-nav" aria-label="Event calendars">
            <details class="calendar-menu">
              <summary>Calendars</summary>
              <div class="calendar-menu-list">
                <a href="/">All events</a>
                <a href="/tango.html">Tango events</a>
              </div>
            </details>
          </nav>
        </div>
      </div>
    </header>`;
}

function renderHead({ title, description, canonical, type = "website" }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  return `<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${safeDescription}">
    <title>${safeTitle}</title>
    <link rel="canonical" href="${canonical}">
    <link rel="icon" type="image/jpeg" href="/assets/dancecharleston-icon.jpg">
    <link rel="apple-touch-icon" href="/assets/dancecharleston-icon.jpg">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="Dance Charleston">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${SITE_URL}/assets/dancecharleston-social.jpg">
    <meta property="og:image:alt" content="DanceCharleston logo on a navy background">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${SITE_URL}/assets/dancecharleston-social.jpg">
    <link rel="stylesheet" href="/styles.css?v=20260811-share-contrast">
  </head>`;
}

function renderFooter() {
  return `<footer>
      <p>&copy; <span data-year></span> Dance Charleston</p>
      <a href="mailto:info@dancecharleston.com">info@dancecharleston.com</a>
    </footer>
    <script src="/script.js?v=20260811-share-offline"></script>`;
}

export function renderEventPage(event) {
  const pageUrl = `${SITE_URL}/events/${event.slug}/`;
  const description = eventDescription(event);
  const calendarBadges = calendarLinks(event)
    .map(
      (calendar) =>
        `<a class="event-badge" href="${calendar.calendarUrl}">${escapeHtml(calendar.label)}</a>`,
    )
    .join("");
  const calendarCtas = calendarLinks(event)
    .map(
      (calendar) =>
        `<a class="community-link" href="${calendar.calendarUrl}">View ${escapeHtml(calendar.label.toLowerCase())}</a>`,
    )
    .join("");
  const sourceLink = event.sourceUrl
    ? `<a class="google-link" href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">View organizer source <span aria-hidden="true">&nearr;</span></a>`
    : "";
  const primaryCalendar =
    CALENDARS.find((calendar) => calendar.key === event.calendarKeys[0]) || CALENDARS[0];

  return `<!doctype html>
<html lang="en">
  ${renderHead({
    title: `${event.title} | Dance Charleston`,
    description,
    canonical: pageUrl,
    type: "article",
  })}
  <body>
    ${renderHeader()}
    <main class="event-page">
      <article>
        <section class="event-hero" aria-labelledby="event-title">
          <div class="event-badges">${calendarBadges}</div>
          <h1 id="event-title">${escapeHtml(event.title)}</h1>
          <p class="event-date">${escapeHtml(displayDate(event))}</p>
          <p class="event-location">${escapeHtml(event.location)}</p>
          ${
            event.status === "https://schema.org/EventCancelled"
              ? '<p class="event-status">This event has been marked as canceled.</p>'
              : ""
          }
        </section>

        <section class="event-facts" aria-label="Event information">
          <div><span>Date and time</span><strong>${escapeHtml(displayDate(event))}</strong></div>
          <div><span>Location</span><strong>${escapeHtml(event.location)}</strong></div>
          ${
            event.organizer
              ? `<div><span>Organizer</span><strong>${escapeHtml(event.organizer)}</strong></div>`
              : ""
          }
        </section>

        ${renderDescription(event.description)}

        <div class="event-actions">
          ${sourceLink}
          ${calendarCtas}
          <a class="submit-link" href="${primaryCalendar.formUrl}" target="_blank" rel="noopener noreferrer">Submit an event <span aria-hidden="true">&nearr;</span></a>
        </div>

        <aside class="calendar-trust" aria-labelledby="event-trust-title">
          <h2 id="event-trust-title">Before you attend</h2>
          <p>Event details can change. Please confirm the latest information with the organizer or venue before attending.</p>
        </aside>
      </article>
    </main>
    ${renderFooter()}
    <script type="application/ld+json">${JSON.stringify(jsonLdForEvent(event, pageUrl)).replaceAll("<", "\\u003c")}</script>
  </body>
</html>
`;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

function renderEventCard(event) {
  const calendarNames = calendarLinks(event).map((calendar) => calendar.label).join(" · ");
  return `<article class="event-card">
            <p class="event-card-date">${escapeHtml(displayDate(event))}</p>
            <h3><a href="/events/${event.slug}/">${escapeHtml(event.title)}</a></h3>
            <p>${escapeHtml(event.location)}</p>
            <p class="event-card-calendar">${escapeHtml(calendarNames)}</p>
          </article>`;
}

export function renderEventIndex(events) {
  const groups = new Map();
  for (const event of events) {
    const label = monthLabel(event.start);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(event);
  }

  const eventGroups = [...groups.entries()]
    .map(
      ([label, monthEvents]) => `<section class="event-month" aria-labelledby="${slugify(label)}">
        <h2 id="${slugify(label)}">${escapeHtml(label)}</h2>
        <div class="event-grid">
          ${monthEvents.map(renderEventCard).join("\n")}
        </div>
      </section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  ${renderHead({
    title: "Upcoming Dance Events in Charleston | Dance Charleston",
    description:
      "Browse upcoming social dances, lessons, workshops, competitions, and Tango events across the Charleston Lowcountry.",
    canonical: `${SITE_URL}/events/`,
  })}
  <body>
    ${renderHeader()}
    <main class="event-index">
      <section class="event-index-intro" aria-labelledby="event-index-title">
        <p class="eyebrow">Upcoming events</p>
        <h1 id="event-index-title">Dance events in Charleston.</h1>
        <p>Search-friendly details generated from the public Dance Charleston and CATS calendars.</p>
        <div class="intro-actions">
          <a class="calendar-link" href="/">View the full calendar</a>
          <a class="community-link" href="/tango.html">View Tango events</a>
        </div>
      </section>
      ${
        eventGroups ||
        '<section class="event-empty"><h2>No upcoming events found</h2><p>Please check the embedded calendars for the latest information.</p></section>'
      }
    </main>
    ${renderFooter()}
  </body>
</html>
`;
}

export function renderSitemap(events, buildDate) {
  const staticUrls = ["/", "/tango.html", "/events/"];
  const urls = [
    ...staticUrls.map((pathname) => ({ url: `${SITE_URL}${pathname}`, priority: pathname === "/" ? "1.0" : "0.8" })),
    ...events.map((event) => ({ url: `${SITE_URL}/events/${event.slug}/`, priority: "0.7" })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ url, priority }) => `  <url>
    <loc>${escapeHtml(url)}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

export async function fetchCalendar(calendar, fetchImpl = fetch) {
  const response = await fetchImpl(calendar.feedUrl, {
    headers: { "user-agent": "DanceCharleston-Event-Page-Generator/1.0" },
  });

  if (!response.ok) {
    throw new Error(`${calendar.name} calendar returned HTTP ${response.status}`);
  }

  const body = await response.text();
  if (!body.includes("BEGIN:VCALENDAR") || !body.includes("BEGIN:VEVENT")) {
    throw new Error(`${calendar.name} calendar did not return a valid event feed`);
  }

  return ical.sync.parseICS(body);
}

export async function generateSite({ rootDir, outputDir, now = new Date(), fetchImpl = fetch }) {
  const range = {
    from: now,
    to: new Date(now.getTime() + EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000),
  };

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const staticPath of STATIC_PATHS) {
    await cp(path.join(rootDir, staticPath), path.join(outputDir, staticPath), {
      recursive: true,
    });
  }

  const eventsByCalendar = await Promise.all(
    CALENDARS.map(async (calendar) => {
      const parsed = await fetchCalendar(calendar, fetchImpl);
      const events = expandCalendarData(parsed, calendar, range);
      if (events.length === 0) {
        throw new Error(`${calendar.name} produced no upcoming events in the ${EVENT_WINDOW_DAYS}-day window`);
      }
      return events;
    }),
  );
  const events = deduplicateEvents(eventsByCalendar.flat());

  if (events.length === 0) {
    throw new Error("The combined calendars produced no publishable events");
  }

  const eventsDir = path.join(outputDir, "events");
  await mkdir(eventsDir, { recursive: true });
  await writeFile(path.join(eventsDir, "index.html"), renderEventIndex(events), "utf8");

  for (const event of events) {
    const eventDir = path.join(eventsDir, event.slug);
    await mkdir(eventDir, { recursive: true });
    await writeFile(path.join(eventDir, "index.html"), renderEventPage(event), "utf8");
  }

  const buildDate = localDateKey(now);
  await writeFile(path.join(outputDir, "sitemap.xml"), renderSitemap(events, buildDate), "utf8");
  await writeFile(
    path.join(eventsDir, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: now.toISOString(),
        windowDays: EVENT_WINDOW_DAYS,
        eventCount: events.length,
        events: events.map((event) => ({
          slug: event.slug,
          title: event.title,
          start: event.start.toISOString(),
          calendars: event.calendarKeys,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return events;
}

export function defaultPaths() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "..");
  return { rootDir, outputDir: path.join(rootDir, "_site") };
}
