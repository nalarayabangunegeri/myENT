# API prod: install (Bun) → generate → build → migrate+start via entrypoint.
# Bun di-pin minor (= CI) — rilis minor baru jangan diam-diam masuk prod.
FROM oven/bun:1.3 AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
RUN bun install --filter=api
COPY apps/api ./apps/api
RUN apps/api/node_modules/.bin/prisma generate --schema apps/api/prisma/schema.prisma \
 && bun --filter api build

FROM oven/bun:1.3
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/node_modules ./node_modules
RUN chmod +x apps/api/entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["apps/api/entrypoint.sh"]
