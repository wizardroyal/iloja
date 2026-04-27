# Iloja

Nigeria's trust-first property marketplace. Pre-build / planning.

- **`plan.md`** — engineering build plan (decisions, tech stack, sprint roadmap).
- **`design/`** — product spec (`iloja-product-doc-v2.docx`) and the seven HTML
  reference screens. Open `design/index.html` in a browser to view.

## Repo layout

```
apps/
  web/         Next.js 14 PWA — renter, agent, landlord (port 3000)
  admin/       Next.js ops console — verification queue, disputes (port 3100)
  api/         NestJS backend — REST + Prisma (port 4000)
  worker/      BullMQ workers — escrow timers, chain anchoring, notifications
packages/
  ui/          Design tokens + Tailwind preset (Forest / Grove / Cream)
  types/       Shared Zod schemas + TS types for the whole domain
```

`packages/{contracts,sdk}` will land alongside the sprints that need them
(Solidity DocumentRegistry in Sprint 5, typed API client when web/admin start
hitting real endpoints). See `plan.md` §5.

## Local development

Requires Node ≥ 20 and pnpm ≥ 9.

```bash
pnpm install
cp .env.example .env             # fill in what you have
pnpm --filter @iloja/api db:generate

pnpm dev          # runs every app's dev script in parallel
pnpm typecheck    # strict TS across the workspace
pnpm lint
pnpm build
pnpm test
```

The API expects Postgres + Redis. Easiest local setup:

```bash
docker run -d --name iloja-pg  -p 5432:5432 -e POSTGRES_PASSWORD=iloja -e POSTGRES_USER=iloja -e POSTGRES_DB=iloja postgres:16
docker run -d --name iloja-redis -p 6379:6379 redis:7
pnpm --filter @iloja/api db:migrate
```

The API tolerates a missing `DATABASE_URL` — it'll boot and log a warning so
you can still iterate on routes that don't need the DB yet.
