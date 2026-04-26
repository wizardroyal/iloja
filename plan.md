# Iloja — Build Plan

> Living document. Reflects decisions made through April 2026. Update when scope or
> stack changes. The product spec lives in `design/iloja-product-doc-v2.docx`; this
> file translates that spec into engineering work.

---

## 0. What we're building

A trust-first property marketplace for Lagos. Five pillars must ship together for
the trust loop to close:

1. **Verified listings** — operator video walkthrough plus GPS cross-check before
   any listing goes live.
2. **Escrow** — for inspection fees, short-let bookings, and long-term rent. 1.5%
   fee, charged to the receiving party.
3. **Credibility** — agent score, badge tiers (New → Blue → Silver → Gold →
   Diamond, plus permanent Founding Agent), renter rental history.
4. **In-app chat + structured offer flow** — every offer/counter timestamped and
   archived.
5. **Document hashing on Base L2** — invisible to users, surfaces only as a
   "Verified Record" badge.

Day-1 scope: short-let bookings and long-term residential rentals. Single Lagos
neighborhood pilot (Yaba, Ikeja, or Surulere — TBD before closed beta). Seven
reference UI screens already exist in `design/`.

---

## 1. Decisions locked in

| Area | Decision |
|---|---|
| Mobile strategy | **PWA-first.** Next.js 14 App Router. Native shell (Expo) deferred until CRM/notifications justify it. |
| Brand / domain | **Placeholder.** "Iloja" name will likely change. Keep all user-facing copy in `i18n/en.json` so a rename is one find-replace. Design tokens are color-and-type only, no logo dependencies. |
| Operator workforce | **Handled directly.** Lightweight operator portal lives inside the admin app. Per-listing payouts via Paystack transfer. |
| Pilot neighborhood | **Deferred.** Not a code blocker. Decide before closed beta (end of Sprint 6). |
| Repo structure | Monorepo: `apps/{web,admin,api,worker}` + `packages/{ui,contracts,types,sdk}`. pnpm workspaces + Turborepo. |

## 2. Decisions still open

| Area | Status |
|---|---|
| KYC vendor | Leaning **Dojah** for v1 — cheapest, broadest Nigerian coverage (BVN/NIN/CAC/liveness), best ergonomics. Wrap behind a `KycProvider` interface so swap to Smile Identity is a config flip. |
| Escrow custodian | **Paystack for collection + Anchor for custody.** Anchor holds funds in segregated, CBN-licensed trust accounts. Paystack handles the card/transfer rail. Anchor KYB onboarding kicks off in parallel with Sprint 0 — it's the longest-lead item. |
| Final brand + domain | TBD. Won't block engineering. |


---

## 3. Why we picked an external escrow custodian

Iloja holds other people's money for short windows: hours for inspections, up to
48 hours for long-term move-in, days for short-lets. In Nigeria, doing that
yourself without a CBN license is functionally illegal — pooling customer funds
in a company bank account is the textbook definition of unlicensed deposit
taking. CBN, EFCC, and SEC all have grounds; your bank will freeze the account
on the first regulatory query.

Two ways out:

1. **Become licensed yourself** — CBN PSSP or eMoney Issuer. ₦100M+ capital,
   12–24 months, dedicated compliance team. The doc names this as a Year 3+
   play (the iNGN stablecoin).
2. **Rent a license** — partner with an entity that already has authorization.
   Funds sit in their segregated trust accounts under their CBN cover. Iloja
   instructs releases via API but is never custodian.

We're going with option 2, split across two providers because each is best at
one job:

| Provider | Role | Why |
|---|---|---|
| **Paystack** | Collection rail | Best card and bank-transfer UX in Nigeria. Subaccounts API. |
| **Anchor** | Escrow custodian | BaaS on a CBN-licensed partner bank. Per-transaction segregated trust accounts. Releases triggered by API call. |

Paystack alone is *acceptable* at MVP (delayed payout to merchant subaccounts
behaves like escrow), but the funds technically sit under Iloja's name —
legally grey, fine until it isn't. We do this right from day one.


---

## 4. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | **Next.js 14 (App Router) PWA** | Reference UI is mobile-web-styled (390px). Ships fast, WhatsApp link previews work natively, native shell wraps cheaply later. |
| Styling | **Tailwind CSS** + design tokens (Forest #1A3C34, Grove #2D6A4F, Cream #F7F4EE, Parchment #EDE9E0, Fraunces + DM Sans) | Reference HTML is hand-rolled CSS. Tailwind preserves palette and typography without a heavy UI kit. |
| Backend | **NestJS (TypeScript)** modular monolith. REST + Socket.io for chat | Shared types with frontend. Module boundaries map onto product domains (listings, escrow, credibility, chat, etc). |
| DB | **Postgres + PostGIS** (Supabase to start, RDS later). **Redis** (cache + queues) | PostGIS for "within 10 mins of Yaba" geo filters. Redis for BullMQ job queues. |
| Storage | **Cloudflare R2** | S3-compatible, no egress fees. Cheap for verification videos and listing photos. |
| Background jobs | **BullMQ** | Drives escrow timers (48hr move-in window, short-let auto-release), verification queue, dispute SLAs, on-chain anchoring batches. |
| Realtime | **Socket.io** | Chat. Offers must hit the server first for timestamp/archival, never peer-to-peer. |
| Auth | **Auth.js** (sessions) + phone OTP via Termii | Decoupled from KYC. KYC drives badge tiers, not login. |
| KYC | **Dojah** | BVN, NIN, CAC, liveness in one contract. Wrap behind `KycProvider` interface. |
| Payments | **Paystack** for collection. **Anchor** for escrow custody. | See §3. |
| Maps | **Mapbox** | Cheaper than Google for Africa; styling matches Forest palette. |
| Push | **Firebase Cloud Messaging** + email fallback (Resend) | Push is mandatory for offers and escrow events. |
| On-chain | **Base L2** + ethers.js + a small `DocumentRegistry.sol` | Doc hashes only. Hourly batch writes via single relayer wallet. Users never see chain UX. |
| Observability | Sentry + Logflare/Axiom + Plausible | Errors, structured logs, privacy-respecting analytics. |
| Hosting | Vercel (frontend) + Render or Fly.io (backend, workers) | Cloudflare in front for Lagos latency. |

### Repo structure

```
apps/
  web/         Next.js PWA — renter, agent, landlord (one app, role-gated routes)
  admin/       Internal ops console — verification queue, disputes, user mgmt, operator portal
  api/         NestJS backend
  worker/      BullMQ workers — escrow timers, chain anchoring, notifications
packages/
  ui/          Design tokens + components ported from design/
  contracts/   Solidity DocumentRegistry + Foundry deploy scripts
  types/       Shared DTOs, Zod schemas
  sdk/         Typed API client (used by web + admin)
infra/         Pulumi or Terraform
design/        Reference UI + product doc
```

Why this and not something simpler:

- **One web app, three roles.** Renters, agents, landlords share 80% of components.
  Splitting triples the work. Role gating in routes is enough.
- **Admin as separate app.** Different threat model (employees only), different
  auth (SSO + MFA), different deploy cadence. A renter-app vulnerability never
  touches the verification queue.
- **API + worker split.** Escrow timers, on-chain anchoring, notification fanout
  must not fight a request thread for resources. They scale on different axes.
- **`packages/sdk`** prevents frontend-backend type drift. Generate from OpenAPI
  (or use tRPC if we'd rather skip codegen — both fine).


---

## 5. Phase 1 — MVP / Pilot (Months 0–6, ~16 weeks)

The doc's Phase 1 is operator verification plus full escrow from day one.

### Sprint 0 — Foundation (weeks 1–2)
- Monorepo: pnpm workspaces, Turborepo, shared tsconfig/eslint/prettier.
- CI: GitHub Actions (lint, typecheck, test, build).
- Vercel + Render envs (staging + production).
- Design system package: tokens (palette, type scale, spacing), shared components
  ported from the seven reference HTML files.
- Postgres schema v1: `users`, `agents`, `properties`, `listings`, `inspections`,
  `offers`, `escrows`, `disputes`, `credibility_events`, `documents`.
- Auth (email + phone OTP), session middleware.
- Sentry, structured logging, admin user model.
- **Anchor KYB application submitted in parallel** — long-lead, do not delay.
- Dojah sandbox account + KYC client behind interface.

### Sprint 1 — Listings + verification queue (weeks 3–4)
- Agent listing creation (port screen 07): 4-step flow → draft → submit. Uploads
  to R2.
- Operator portal (inside admin app): claim job, run standardized checklist,
  capture geotagged photos + video, submit GPS coords.
- Admin verification queue: review submission, approve → listing goes live with
  Verified Property badge; reject with reason.
- GPS cross-check: server compares operator coords vs. Mapbox-geocoded address.
  Mismatches > 200m flagged for human review.
- Operator payouts (Paystack transfers, per verified listing).

### Sprint 2 — Discovery + property detail (weeks 5–6)
- Home (port screen 01): list + map view, filters (neighborhood, price, type,
  badge tier, availability date), saved searches, wishlist.
- Price benchmarking: nightly job computes p25/median/p75 by (neighborhood,
  bedrooms, type). Surfaced on every listing and detail page.
- Property detail (port screen 02): photo gallery, verified ribbon, agent card
  with credibility ring, escrow CTA, benchmarking strip.
- Agent profile (port screen 03): credibility ring, badge, listings, reviews,
  about — read-only.
- Shareable URLs + WhatsApp link previews (OG tags: photo, price, verified
  badge, agent score).

### Sprint 3 — Chat + offer flow (weeks 7–8)
- Real-time chat (port screen 05): Socket.io with persistence, read receipts,
  typing indicators.
- Structured offers: offer card → counter → accept/decline. Every transition is
  a row in `offers` with timestamp, party, hash. Permanent.
- Inspection booking inside chat: pick slot, both parties confirmed, calendar
  entries on both sides.
- Reminder jobs: 24hr + 1hr before inspection.

### Sprint 4 — Escrow (weeks 9–11) — hardest sprint
Three flows, same primitives, different release conditions:

1. **Inspection-fee escrow** (port screen 04, the 3-step flow):
   - Renter pays into Anchor trust account via Paystack.
   - Renter taps "I'm here" → server validates GPS within 100m → unlocks
     confirm/dispute UI.
   - Confirm → Anchor releases to agent (1.5% fee). Dispute → frozen, admin
     queue.
2. **Short-let booking escrow:** full booking held; release on GPS check-in +
   1hr grace; auto-release after 24hr if no dispute.
3. **Long-term rent escrow:** full annual rent held; 48-hour move-in window from
   key handover; auto-release if no dispute.

- BullMQ delayed jobs drive every timer. Idempotent — never double-release.
- Dispute admin tooling: evidence viewer, decision log, outcome triggers
  refund/release + credibility event.
- Webhook security: Paystack/Anchor signature verification, replay protection.
- Dry-run mode toggle for staging — never spend real money against a real
  escrow account in test.

### Sprint 5 — Credibility + on-chain anchoring (weeks 12–13)
- `credibility_events` table: every review, no-show, completed rental, dispute
  outcome, listing inaccuracy flag writes a row with weight.
- Score + badge computation: nightly job, weighted per the doc (review ratings
  High, show-up High, verified ratio High, response Medium, completed rentals
  Medium, accuracy Medium, account history Low). Event-sourced — never just
  `UPDATE`.
- `DocumentRegistry.sol` deployed to Base via Foundry. Single method:
  `anchor(bytes32 hash, bytes32 docType, string uri)`.
- Anchor worker: hourly batch — pulls every new signed agreement, inspection
  report, escrow receipt, dispute outcome, credibility snapshot. Writes hashes
  via relayer wallet. Stores `(txHash, blockNumber)` back on the document row.
- "Verified Record" UI: tappable badge on every Iloja-generated document → modal
  shows type + timestamp + "View on-chain" deep link. Zero crypto vocabulary.

### Sprint 6 — Notifications + agent dashboard + polish (weeks 14–16)
- FCM push: new messages, offers, inspection confirmations, escrow events, price
  drops, saved-search matches.
- Agent dashboard (port screen 06): score widget, lead pipeline, inspection
  calendar, listing analytics. Read-only metrics in v1.
- Admin: user warnings/restrictions/bans, listing flag review queue, periodic
  re-verification scheduler.
- Performance pass: image CDN tuning, route prefetch, p95 < 2s on 3G.
- Closed beta with 5 founding agents in pilot neighborhood. Telemetry-instrumented
  funnel.

### Phase 1 launch criteria
- 50+ verified listings live in pilot neighborhood.
- Inspection-fee escrow tested end-to-end with real money across 10+ inspections.
- Short-let bookings: 3+ hosts with calendars synced.
- All seven reference screens production-equivalent.
- Document hashes anchoring on Base mainnet, "Verified Record" UI shipping.
- Sentry < 0.5% session error rate, p95 API < 400ms.


---

## 6. Phase 2 — Community accountability + revenue (Months 6–18)

- **Community verification:** renters submit timestamped photo/video at
  inspection. Verified discrepancy auto-docks credibility, publishes flag on
  listing.
- **Community flagging UI** on every active listing.
- **Agent CRM subscription** (₦15K–₦25K/mo via Paystack subscriptions): unlocks
  lead pipeline detail, renter profile preview pre-confirmation, advanced
  analytics, listing scheduling. Hard paywall.
- **Affiliate integrations:** movers, internet, DSTV, cleaning. Referral links +
  tracking on confirmed move-in.
- **Saved-search push alerts** before WhatsApp distribution (timing window
  tightened).
- **Founding Agent program:** hard-coded badge for first 20 per zone,
  non-removable.
- **Tenancy agreement template generator:** structured fields → PDF → hashed →
  anchored.

## 7. Phase 3 — Maturity (Month 18+)

- **Third-party inspection marketplace:** licensed firms onboard, agent pays
  them directly, Iloja takes coordination fee.
- **Corporate relocation concierge:** B2B portal for HR teams, bulk placements.
- **Market data product:** aggregated, anonymized pricing/demand API + dashboard
  for developers, lenders, government.
- **Deposit insurance** distribution partnership.
- **iNGN exploration** — CBN-dependent, gated on volume.

---

## 8. Cross-cutting concerns

- **Security:** BVN/NIN never logged or returned to client. PII encrypted at rest
  (pgcrypto). Webhook signature checks. Dispute evidence stored with signed URLs
  only. Rate-limit all auth + offer endpoints.
- **Money safety:** every escrow state transition is event-sourced and
  idempotent. Ledger table reconciled nightly against Anchor balances. Alert on
  drift.
- **Compliance:** NDPR data subject endpoints (export, delete). Audit log for
  admin actions. KYC tiering matches CBN expectations even though Anchor is the
  licensed party.
- **Off-platform leakage:** any agent steering renters off-platform (detectable
  via chat NLP heuristics) gets a credibility hit. The doc is explicit that
  off-platform interactions are unprotected.
- **Testing:** contract tests against Paystack/Anchor sandbox. Playwright E2E
  for the seven hero flows. Load test escrow timers (10K concurrent delayed
  jobs).
- **Observability:** trace IDs through web → API → worker → chain anchor.
  Dashboards for verification queue depth, dispute backlog, escrow age.
- **Disaster recovery:** Postgres PITR. R2 versioning on. Anchored hashes are
  the ultimate tamper-proof backup.

---

## 9. Open questions & risks

- **Pilot neighborhood selection.** Choose by end of Sprint 6.
- **Anchor KYB timeline.** Could slip 1–3 weeks. Mitigation: stub the escrow
  custodian behind an interface and run sandbox-only against Paystack-only
  during Sprints 1–3.
- **NIMC outages.** NIN verification depends on NIMC uptime. Cache successful
  verifications. Don't gate critical flows on real-time NIN checks.
- **Chain anchoring cost spikes.** Base L2 is cheap but not free. Batch hourly,
  not per-event. Track gas spend; alert at 2× baseline.
- **Final brand.** A rename mid-build is annoying but not blocking. All copy in
  `i18n/en.json`; tokens are color-only.

