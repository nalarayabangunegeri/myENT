#!/bin/sh
# Entrypoint prod: migration dulu (PRD §19: skema hanya lewat migration), baru start.
set -e
./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
exec bun apps/api/dist/main.js
