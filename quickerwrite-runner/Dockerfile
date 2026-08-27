FROM node:22-bookworm-slim
WORKDIR /opt/dashi-ppt-skill
COPY . .
RUN cd skills/dashi-ppt/project \
 && npm ci --ignore-scripts \
 && npx --no-install playwright-core install --with-deps chromium-headless-shell \
 && mkdir -p /data \
 && chown -R node:node /data /opt/dashi-ppt-skill
ENV QW_RUNNER_HOST=0.0.0.0 QW_RUNNER_PORT=8080 QW_RUNNER_OUTPUT_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
USER node
CMD ["node", "quickerwrite-runner/server.mjs"]
