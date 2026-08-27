# QuickerWrite isolated runner

This runner remains in the AGPL-3.0 repository and exposes QuickerWrite's
neutral `v1` JSON protocol. QuickerWrite calls it over HTTP and never imports
or packages the Dashi runtime.

```bash
docker build -f quickerwrite-runner/Dockerfile -t dashi-ppt-runner:local .
docker run --rm -p 127.0.0.1:5802:8080 -e QW_RUNNER_SHARED_SECRET=change-me dashi-ppt-runner:local
```

`/v1/previews/theme-grid` and `/v1/previews/hero-result` read the cloned
`theme-style-grid.png`; runtime preview selection does not depend on GitHub.
The corresponding-source offer and archive are served locally by `/source`
and `/source/archive`; runtime image/source links do not depend on GitHub.
