FROM node:24-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/client/package.json apps/client/

FROM manifests AS runtime
ENV NODE_ENV=production \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --workspace @oilguard/api --omit=dev --omit=optional --no-audit --no-fund \
    && npm cache clean --force
COPY apps/api/src apps/api/src/
COPY apps/api/migrations apps/api/migrations/
USER node

FROM runtime AS worker
ENV WORKER_HEALTH_PORT=3336 DB_POOL_MAX=2
HEALTHCHECK --interval=10s --timeout=4s --start-period=30s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.WORKER_HEALTH_PORT + '/healthz', {signal: AbortSignal.timeout(3000)}).then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/api/src/worker.js"]

FROM manifests AS website
RUN npm ci --workspace @oilguard/client --include=dev --no-audit --no-fund
COPY apps/client/index.html apps/client/vite.config.ts apps/client/capacitor.config.ts apps/client/tsconfig*.json apps/client/
COPY apps/client/src apps/client/src/
RUN npm run build

FROM runtime AS api
COPY --from=website /app/apps/client/dist apps/client/dist/
ENV PORT=3333 HOST=0.0.0.0 SERVE_WEB=true DB_POOL_MAX=5 UV_THREADPOOL_SIZE=2
EXPOSE 3333
HEALTHCHECK --interval=10s --timeout=4s --start-period=30s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz', {signal: AbortSignal.timeout(3000)}).then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/api/src/server.js"]
