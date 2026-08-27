FROM node:22-bookworm-slim
WORKDIR /opt/dashi-ppt-skill
COPY LICENSE README.md ./
COPY quickerwrite-runner ./quickerwrite-runner
COPY skills/dashi-ppt/assets/skill/theme-style-grid.png ./skills/dashi-ppt/assets/skill/theme-style-grid.png
COPY skills/dashi-ppt/project/package.json skills/dashi-ppt/project/package-lock.json skills/dashi-ppt/project/.npmrc ./skills/dashi-ppt/project/
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN cd skills/dashi-ppt/project \
 && npm ci --ignore-scripts
COPY skills/dashi-ppt/project ./skills/dashi-ppt/project
RUN cd skills/dashi-ppt/project \
 && npx --no-install playwright-core install --with-deps chromium-headless-shell \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data \
 && chown -R node:node /data /opt/dashi-ppt-skill /ms-playwright
ENV QW_RUNNER_HOST=0.0.0.0 QW_RUNNER_PORT=8080 QW_RUNNER_OUTPUT_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
USER node
CMD ["node", "quickerwrite-runner/server.mjs"]
