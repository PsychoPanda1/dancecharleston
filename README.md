# Dance Charleston public calendar site

A lightweight static site for the public Dance Charleston and CATS calendars. It keeps the calendars as the single source of truth while generating indexable HTML pages for upcoming events.

## How publishing works

- The public Google Calendar feeds are read during each build; no Google credentials are stored in GitHub.
- Events with a title, start time, and location receive an individual page under `/events/` with Event structured data.
- A public source URL is included when present, but it is not required.
- Recurring events, exceptions, cancellations, Eastern time offsets, and duplicate listings are handled by the generator.
- The generated event index and `sitemap.xml` are rebuilt every day at 7:15 AM Eastern and whenever `main` changes.
- Tests and output validation must pass before GitHub Pages deploys. A failed build leaves the previously successful site online.

Generated files live in `_site/` and are intentionally excluded from Git. The source site remains entirely separate from the operations dashboard in `../dashboard`.

## Local preview

From this directory, install dependencies, verify the generator, and build the site:

```powershell
pnpm install
pnpm test
pnpm run build
pnpm run validate
python -m http.server 8000 --directory _site
```

Then open `http://localhost:8000`. To reproduce the build for a specific instant, set `BUILD_NOW` before running the build:

```powershell
$env:BUILD_NOW = "2026-08-11T12:00:00-04:00"
pnpm run build
```

## Public data sources

- Dance Charleston: `info@dancecharleston.com`
- CATS: `c_4c505db2b59a8993633fcaba1fb116ad84b21e38d154a69b62c90276b96467bf@group.calendar.google.com`

The corresponding public iCalendar feeds are configured in `scripts/event-generator.mjs`.
