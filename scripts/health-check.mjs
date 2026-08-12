const checks = [
  { url: "https://dancecharleston.com/", includes: "Dance Charleston | Local Dance Calendar" },
  { url: "https://dancecharleston.com/tango.html", includes: "CATS Tango Calendar" },
  { url: "https://dancecharleston.com/site.webmanifest", includes: "Dance Charleston" },
  { url: "https://dancecharleston.com/sitemap.xml", includes: "<urlset" },
  { url: "https://dancecharleston.com/offline.html", includes: "The calendar will be back with the music" },
  { url: "https://docs.google.com/forms/d/e/1FAIpQLSdtve1qHMu8uiXk-7clxj9_CTjhGLVZBG0jekx14N9eMEXDKA/viewform?usp=publish-editor" },
  { url: "https://docs.google.com/forms/d/e/1FAIpQLSf4A45UAccYHl8zE7hgY9HkON56QdYxswsVDllp-YPc1j0K_A/viewform?usp=dialog" },
];

const failures = [];
for (const check of checks) {
  try {
    const response = await fetch(check.url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    const body = check.includes ? await response.text() : "";
    if (!response.ok || (check.includes && !body.includes(check.includes))) {
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
