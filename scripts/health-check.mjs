const checks = [
  {
    url: "https://dancecharleston.com/",
    includes: ["Dance Charleston | Local Dance Calendar", "1FAIpQLSdtve1qHMu8uiXk-7clxj9_CTjhGLVZBG0jekx14N9eMEXDKA"],
  },
  {
    url: "https://dancecharleston.com/tango.html",
    includes: ["CATS Tango Calendar", "1FAIpQLSf4A45UAccYHl8zE7hgY9HkON56QdYxswsVDllp-YPc1j0K_A"],
  },
  { url: "https://dancecharleston.com/site.webmanifest", includes: "Dance Charleston" },
  { url: "https://dancecharleston.com/sitemap.xml", includes: "<urlset" },
  { url: "https://dancecharleston.com/offline.html", includes: "The calendar will be back with the music" },
];

const failures = [];
for (const check of checks) {
  try {
    const response = await fetch(check.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; DanceCharlestonHealthCheck/1.0; +https://dancecharleston.com/)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
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

if (failures.length) {
  console.error(`Dance Charleston health check failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Dance Charleston health check passed (${checks.length} endpoints).`);
}
