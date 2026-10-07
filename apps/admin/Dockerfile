# Admin prod: install via Bun (tanpa npm), build + jalan di Node (standalone).
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/admin/package.json apps/admin/
RUN bun install --filter=admin

FROM node:22-bookworm-slim AS build
# NEXT_PUBLIC_* dibakar ke JS client saat build — wajib sebagai build arg.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY package.json ./
COPY apps/admin ./apps/admin
WORKDIR /app/apps/admin
RUN ./node_modules/.bin/next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3102 HOSTNAME=0.0.0.0
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
EXPOSE 3102
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3102/login').then(()=>process.exit(0)).catch(()=>process.exit(1))"
USER node
CMD ["node", "apps/admin/server.js"]
