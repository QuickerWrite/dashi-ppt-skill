# QuickerWrite isolated runner

This runner remains in the AGPL-3.0 repository and exposes QuickerWrite's
neutral `v1` JSON protocol. QuickerWrite calls it over HTTP and never imports
or packages the Dashi runtime.

## Changes in this fork

- Added asynchronous neutral-v1 job submission, polling, and artifact
  downloads for HTML and editable PPTX.
- Added optional HMAC-SHA256 request authentication with a five-minute replay
  window.
- Mapped QuickerWrite's neutral slide DTO to Dashi briefs, goal scaffolding,
  safe props, and the existing theme renderer.
- Kept all 12 theme runtimes and added a native PptxGenJS theme adapter; removed standalone
  layout-query, inspection, interactive preview-launcher, and duplicate
  validation CLIs that the Runner never invokes.
- Reduced the unused three-candidate layout workflow to one selected layout
  per slide. QuickerWrite has no candidate picker, and several themes expose
  only one compatible cover layout.
- Reduced the Docker image to the required project runtime, preview sheet,
  Runner, license, and source metadata. npm publishing, Agent installers,
  repository automation, and documentation-only resources are not shipped.
- Replaced Chromium/Playwright/HTML-capture export with native PptxGenJS.
  PPTX text, shapes, and charts remain editable; the image no longer installs
  a browser or OpenSSL and does not ship the proprietary legacy exporter.
- Restricted previews to the two IDs advertised by QuickerWrite and rewrote
  generated GitHub navigation to the local `/source` offer.

## Supported contract

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Container health probe |
| `POST` | `/v1/jobs` | Submit a neutral v1 deck job |
| `GET` | `/v1/jobs/{id}` | Poll job state |
| `GET` | `/v1/jobs/{id}/artifacts/{html,pptx}` | Download an artifact |
| `GET` | `/v1/previews/{theme-grid,hero-result}` | Read the local preview sheet |
| `GET` | `/source` and `/source/archive` | AGPL corresponding-source offer |

```bash
docker build -f quickerwrite-runner/Dockerfile -t dashi-ppt-runner:local .
docker run --rm -p 127.0.0.1:5802:8080 -e QW_RUNNER_SHARED_SECRET=change-me dashi-ppt-runner:local
```

`/v1/previews/theme-grid` and `/v1/previews/hero-result` read the cloned
`theme-style-grid.png`; runtime preview selection does not depend on GitHub.
The corresponding-source offer and archive are served locally by `/source`
and `/source/archive`; runtime image/source links do not depend on GitHub.

The default QuickerWrite request asks for PPTX and HTML. Theme `auto` selects from the retained 12-theme
runtime using the deck title; `theme01` through `theme12` can be requested
directly.

HTML and PPTX consume the same neutral slide content. The HTML renderer keeps
the original interactive theme runtime, while the PPTX renderer uses native
PowerPoint primitives tuned to the same 12 visual identities. CSS-only motion
and browser effects cannot be mathematically identical in OOXML, but the
palette, typography hierarchy, composition rhythm, and theme motifs are kept
visually close without sacrificing editability.
