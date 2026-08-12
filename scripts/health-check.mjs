const pageChecks = [
  {
    url: "https://dancecharleston.com/",
    includes: ["Dance Charleston | Local Dance Calendar", "1FAIpQLSdtve1qHMu8uiXk-7clxj9_CTjhGLVZBG0jekx14N9eMEXDKA"],
  },
  {
    url: "https://dancecharleston.com/tango.html",
    includes: ["CATS Tango Calendar", "1FAIpQLSf4A45UAccYHl8zE7hgY9HkON56QdYxswsVDllp-YPc1j0K_A"],
  },
  { url: "https://dancecharleston.com/site.webmanifest", includes: "Dance Charleston" },
  { url: "https://dancecharleston.com/offline.html", includes: "The calendar will be back with the music" },
];

const calendarChecks = [
  {
    name: "Dance Charleston calendar feed",
    url: "https://calendar.google.com/calendar/ical/info%40dancecharleston.com/public/basic.ics",
  },
  {
    name: "CATS Tango calendar feed",
    url: "https://calendar.google.com/calendar/ical/c_4c505db2b59a8993633fcaba1fb116ad84b21e38d154a69b62c90276b96467bf%40group.calendar.google.com/public/basic.ics",
  },
];

const formChecks = [
  "https://docs.google.com/forms/d/e/1FAIpQLSdtve1qHMu8uiXk-7clxj9_CTjhGLVZBG0jekx14N9eMEXDKA/viewform?usp=publish-editor",
  "https://docs.google.com/forms/d/e/1FAIpQLSf4A45UAccYHl8zE7hgY9HkON56QdYxswsVDllp-YPc1j0K_A/viewform?usp=dialog",
];

const requestHeaders = {
  "user-agent": "Mozilla/5.0 (compatible; DanceCharlestonHealthCheck/1.0; +https://dancecharleston.com/)",
  accept: "text/html,application/xhtml+xml,application/xml,text/calendar;q=0.9,*/*;q=0.8",
};

const failures = [];
for (const check of pageChecks) {
  try {
    const response = await fetch(check.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: requestHeaders,
    });
    const expectedContent = check.includes ? (Array.isArray(check.includes) ? check.includes : [check.includes]) : [];
    const body = expectedContent.length ? await response.text() : "";
    const contentMissing = expectedContent.some((expected) => !body.includes(expected));
    if (!response.ok || contentMissing) {
      failures.push(`${check.url}: HTTP ${response.status}${check.includes ? " or expected content missing" : ""}`);
    }
  } catch (error) {
    failures.push(`${check.url}: ${error.message}`);
  }
}

for (const check of calendarChecks) {
  try {
    const response = await fetch(check.url, { signal: AbortSignal.timeout(15000), headers: requestHeaders });
    const body = await response.text();
    if (!response.ok || !body.includes("BEGIN:VCALENDAR") || !body.includes("BEGIN:VEVENT")) {
      failures.push(`${check.name}: HTTP ${response.status} or invalid calendar feed`);
    }
  } catch (error) {
    failures.push(`${check.name}: ${error.message}`);
  }
}

for (const url of formChecks) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: requestHeaders,
    });
    const location = response.headers.get("location") || "";
    if (![200, 302].includes(response.status) || (response.status === 302 && !location.includes("accounts.google.com"))) {
      failures.push(`${url}: unexpected form response HTTP ${response.status}`);
    }
  } catch (error) {
    failures.push(`${url}: ${error.message}`);
  }
}

try {
  const sitemapResponse = await fetch("https://dancecharleston.com/sitemap.xml", {
    signal: AbortSignal.timeout(15000),
    headers: requestHeaders,
  });
  const sitemap = await sitemapResponse.text();
  const eventUrls = [...sitemap.matchAll(/<loc>(https:\/\/dancecharleston\.com\/events\/[^<]+)<\/loc>/g)].map((match) => match[1]);
  if (!sitemapResponse.ok || eventUrls.length === 0) {
    failures.push("sitemap.xml: no generated event URLs found");
  } else {
    const eventResponse = await fetch(eventUrls[0], { signal: AbortSignal.timeout(15000), headers: requestHeaders });
    const eventHtml = await eventResponse.text();
    if (!eventResponse.ok || !eventHtml.includes('type="application/ld+json"')) {
      failures.push(`${eventUrls[0]}: generated event page or Event JSON-LD missing`);
    }
  }
} catch (error) {
  failures.push(`Generated event check: ${error.message}`);
}

try {
  const dns = await import("node:dns/promises");
  const [addresses, certificateResponse] = await Promise.all([
    dns.resolve4("dancecharleston.com"),
    fetch("https://dancecharleston.com/", { method: "HEAD", signal: AbortSignal.timeout(15000), headers: requestHeaders }),
  ]);
  if (addresses.length === 0 || !certificateResponse.ok) failures.push("DNS or HTTPS check returned no usable result");
} catch (error) {
  failures.push(`DNS or HTTPS check: ${error.message}`);
}

if (failures.length) {
  console.error(`Dance Charleston health check failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Dance Charleston health check passed (${pageChecks.length} pages, ${calendarChecks.length} calendars, ${formChecks.length} forms, sitemap/event, DNS, and HTTPS).`,
  );
}
