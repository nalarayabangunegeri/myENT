#!/bin/sh
# Entrypoint prod: migration dulu (PRD §19: skema hanya lewat migration), baru start.
# ponytail: migrate tiap start aman untuk 1 replika (default). Jangan scale api >1
# tanpa job migrasi one-shot — dua migrate deploy konkuren bisa berebut advisory lock.
set -e
./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
exec bun apps/api/dist/main.js
