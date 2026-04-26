# Iloja

Nigeria's trust-first property marketplace. Pre-build / planning.

- **`plan.md`** — engineering build plan (decisions, tech stack, sprint roadmap).
- **`design/`** — product spec (`iloja-product-doc-v2.docx`) and the seven HTML
  reference screens. Open `design/index.html` in a browser to view.

## Repo layout

```
apps/
  web/         Next.js 14 PWA — renter, agent, landlord
  api/         NestJS backend
packages/
  ui/          Design tokens + Tailwind preset (Forest / Grove / Cream)
```

`apps/admin`, `apps/worker`, and `packages/{contracts,types,sdk}` will land as
the corresponding sprints begin. See `plan.md` §5.

## Local development

Requires Node ≥ 20 and pnpm ≥ 9.

```bash
pnpm install
pnpm dev          # runs every app's dev script in parallel
pnpm typecheck    # strict TS across the workspace
pnpm lint
pnpm build
```

Web dev server runs on `http://localhost:3000`. API health check on
`http://localhost:4000/health`.
