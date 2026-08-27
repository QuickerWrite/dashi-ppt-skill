FROM node:22-bookworm-slim
WORKDIR /opt/dashi-ppt-skill
COPY --chown=node:node LICENSE README.md ./
COPY --chown=node:node quickerwrite-runner ./quickerwrite-runner
COPY --chown=node:node skills/dashi-ppt/assets/skill/theme-style-grid.png ./skills/dashi-ppt/assets/skill/theme-style-grid.png
COPY --chown=node:node skills/dashi-ppt/project/package.json skills/dashi-ppt/project/package-lock.json skills/dashi-ppt/project/.npmrc ./skills/dashi-ppt/project/
RUN cd skills/dashi-ppt/project \
 && npm ci --ignore-scripts
COPY --chown=node:node skills/dashi-ppt/project ./skills/dashi-ppt/project
RUN mkdir -p /data \
 && chown node:node /data
ENV QW_RUNNER_HOST=0.0.0.0 QW_RUNNER_PORT=8080 QW_RUNNER_OUTPUT_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
USER node
CMD ["node", "quickerwrite-runner/server.mjs"]
