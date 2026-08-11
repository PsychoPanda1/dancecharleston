import assert from "node:assert/strict";
import test from "node:test";
import ical from "node-ical";
import {
  CALENDARS,
  deduplicateEvents,
  escapeHtml,
  expandCalendarData,
  extractSourceUrl,
  htmlToText,
  renderEventPage,
  slugify,
  structuredDate,
} from "../scripts/event-generator.mjs";

test("escapes markup and creates stable readable slugs", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(slugify("CATS: Tuesday Milonga!"), "cats-tuesday-milonga");
});

test("converts calendar HTML descriptions to plain text", () => {
  assert.equal(
    htmlToText("<p>Weekly dance &amp; lesson.</p><p>Bring shoes.<br>All levels.</p>"),
    "Weekly dance & lesson.\nBring shoes.\nAll levels.",
  );
});

test("source links are optional and extracted when present", () => {
  assert.equal(extractSourceUrl("No public source supplied."), "");
  assert.equal(
    extractSourceUrl("Details: https://example.com/event."),
    "https://example.com/event",
  );
});

test("structured dates retain Eastern daylight and standard offsets", () => {
  assert.equal(structuredDate(new Date("2026-08-11T23:00:00Z")), "2026-08-11T19:00:00-04:00");
  assert.equal(structuredDate(new Date("2026-12-11T00:00:00Z")), "2026-12-10T19:00:00-05:00");
});

test("recurring events expand with excluded dates removed", () => {
  const fixture = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:weekly-tango@example.com
DTSTART;TZID=America/New_York:20260811T190000
DTEND;TZID=America/New_York:20260811T220000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=America/New_York:20260818T190000
SUMMARY:Tango Tuesday
LOCATION:Example Hall, Charleston, SC
DESCRIPTION:<p>Weekly Tango.</p>
END:VEVENT
END:VCALENDAR`;
  const parsed = ical.sync.parseICS(fixture);
  const events = expandCalendarData(parsed, CALENDARS[1], {
    from: new Date("2026-08-10T00:00:00Z"),
    to: new Date("2026-09-10T00:00:00Z"),
  });

  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((event) => event.start.toISOString()),
    ["2026-08-11T23:00:00.000Z", "2026-08-25T23:00:00.000Z", "2026-09-01T23:00:00.000Z"],
  );
});

test("duplicate calendar entries merge without requiring a source URL", () => {
  const base = {
    id: "abc",
    uid: "abc@example.com",
    slug: "2026-08-11-test-event-abc",
    title: "Test Event",
    start: new Date("2026-08-11T23:00:00Z"),
    end: new Date("2026-08-12T01:00:00Z"),
    isFullDay: false,
    location: "Example Hall, Charleston, SC",
    description: "Short description.",
    organizer: "",
    sourceUrl: "",
    status: "https://schema.org/EventScheduled",
    calendarKeys: ["all"],
  };
  const duplicate = {
    ...base,
    description: "A longer description with more useful event details.",
    calendarKeys: ["tango"],
  };
  const [merged] = deduplicateEvents([base, duplicate]);

  assert.deepEqual(merged.calendarKeys.sort(), ["all", "tango"]);
  assert.equal(merged.description, duplicate.description);
  assert.equal(merged.sourceUrl, "");
});

test("event pages include visible facts and valid JSON-LD without a source URL", () => {
  const event = {
    id: "abc12345",
    uid: "abc@example.com",
    slug: "2026-08-11-test-event-abc12345",
    title: "Test Event",
    start: new Date("2026-08-11T23:00:00Z"),
    end: new Date("2026-08-12T01:00:00Z"),
    isFullDay: false,
    location: "Example Hall, Charleston, SC",
    description: "A welcoming social dance for all levels.",
    organizer: "Example Dance Club",
    sourceUrl: "",
    status: "https://schema.org/EventScheduled",
    calendarKeys: ["all"],
  };
  const html = renderEventPage(event);
  const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);

  assert.ok(html.includes("Test Event"));
  assert.ok(html.includes("Example Hall, Charleston, SC"));
  assert.ok(!html.includes("View organizer source"));
  assert.ok(jsonMatch);
  const data = JSON.parse(jsonMatch[1]);
  assert.equal(data.name, "Test Event");
  assert.equal(data.startDate, "2026-08-11T19:00:00-04:00");
  assert.equal(data.location["@type"], "Place");
});
