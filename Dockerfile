# The Ninth Mind website in one image. Works on any VPS (see deploy/) or a container host.
#   docker build -t ninthmind-web .
#   docker run -p 3000:3000 --env-file .env -v ninthmind-data:/app/.data ninthmind-web
ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# VITE_SITE_URL sets the canonical address, Open Graph links and the sitemap
ARG VITE_SITE_URL=https://www.ninthmind.ai
ENV NODE_ENV=production VITE_SITE_URL=${VITE_SITE_URL}
RUN bun run build

FROM oven/bun:${BUN_VERSION} AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/.data
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY server.ts tsconfig.json ./
COPY src ./src
# leads, analytics and the report state live here: keep it on a volume
RUN mkdir -p /app/.data && chown -R bun:bun /app/.data
VOLUME /app/.data
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD bun -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "server.ts"]
