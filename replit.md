# TradieAfterDark

Australia's after-hours trade service marketplace. Connects verified tradies with customers for evening and weekend jobs.

## Architecture

### Monorepo Structure
```
artifacts/
  api-server/          — Express + TypeScript backend (port 8080, proxied at /api)
  tradie-after-dark/   — React + Vite + Tailwind frontend (port 24655, proxied at /)
lib/
  api-spec/            — OpenAPI spec + orval codegen config
  api-client-react/    — Generated TanStack Query hooks (custom-fetch, cookies included)
  api-zod/             — Generated Zod schemas from OpenAPI spec
  db/                  — Drizzle ORM schema + migrations + pg pool
scripts/
  src/seed.ts          — Database seed (admin, 4 tradies, 5 customers, jobs, reviews)
```

### Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter, react-hook-form, zod
- **Backend**: Express, TypeScript, pino logging
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (httpOnly cookies) — 15min access token, 30d refresh token with family rotation
- **Payments**: Stripe subscriptions (dev mode simulates without key)
- **API Contract**: OpenAPI 3.1 → orval codegen (hooks + zod schemas)

## Brand

- Background: `#0D0D0D` dark charcoal (dark mode default)
- Primary: `#FF6B00` electric orange
- Foreground: `#F5F5F5` off-white
- Fonts: Syne (headings), Inter (body)

## Database Schema

Tables: `users`, `refresh_tokens`, `password_reset_tokens`, `tradie_profiles`, `tradie_licences`, `portfolio_images`, `customer_favourites`, `jobs`, `messages`, `reviews`, `disputes`, `stripe_webhook_events`, `admin_verification_logs`

Enums: `role` (TRADIE | CUSTOMER | ADMIN), `verification_status` (PENDING | VERIFIED | REJECTED | EXPIRED | SELF_DECLARED), `job_status` (ENQUIRY | ACCEPTED | IN_PROGRESS | COMPLETED | CANCELLED | DISPUTED), `dispute_status` (OPEN | UNDER_REVIEW | RESOLVED | DISMISSED)

## Auth Flow

- JWT access token (15min) in `access_token` httpOnly cookie
- Refresh token (30d) in `refresh_token` httpOnly cookie (path `/api/auth`)
- Refresh token rotation with family-based reuse detection
- Signup creates tradie profile stub for TRADIE role

## Tradie Lifecycle

1. Sign up → stub profile created
2. Onboarding: identity → trade info → availability → licence → insurance → payment
3. Admin verifies identity, licence, insurance documents
4. Once all verified + payment confirmed → `isLive = true` → appears in search

## Subscription (Stripe)

- Monthly: $49/mo, Annual: $39/mo ($469/yr)
- Without `STRIPE_SECRET_KEY` env var: dev mode simulates checkout success
- Webhook at `/api/webhooks/stripe` with idempotency via `stripe_webhook_events`

## API Routes

- `GET /api/healthz`
- `POST /api/auth/signup|login|logout|refresh|forgot-password|reset-password`
- `GET /api/auth/me`
- `GET /api/tradies` (public, filterable by trade/postcode/availability)
- `GET /api/tradies/:slug` (public tradie profile)
- `GET /api/tradies/:slug/reviews`
- `GET /api/config/trades`
- `POST /api/tradie/onboarding/identity|trade|availability|licence|insurance|checkout`
- `POST /api/tradie/upload-url`
- `GET/PATCH /api/tradie/profile`
- `GET /api/tradie/subscription`, `POST /api/tradie/billing-portal`
- `GET /api/tradie/licences`, `POST /api/tradie/licences/:id/resubmit`
- `POST/DELETE /api/tradie/portfolio`
- `GET /api/tradie/stats`
- `GET/POST/DELETE /api/customer/favourites/:tradieId`
- `GET/POST /api/jobs`, `GET /api/jobs/:jobId`
- `POST /api/jobs/:jobId/accept|start|complete|cancel|dispute`
- `GET/POST /api/jobs/:jobId/messages`
- `GET /api/inbox`
- `POST /api/jobs/:jobId/review`
- `GET /api/admin/dashboard|verifications|identity|insurance|tradies|disputes`
- `POST /api/admin/verifications/:id/approve|reject`
- `POST /api/admin/identity/:id/approve|reject`
- `POST /api/admin/insurance/:id/approve|reject`
- `POST /api/admin/tradies/:id/suspend|reinstate`
- `POST /api/admin/disputes/:id/resolve`
- `GET/POST /api/admin/moderation/reviews|portfolio`
- `POST /api/webhooks/stripe`

## Frontend Pages

- `/` — Home (hero, how it works, featured tradies, CTA)
- `/search` — Tradie search with filters (trade, postcode, availability)
- `/tradie/:slug` — Public tradie profile (bio, portfolio, licences, reviews, enquiry modal)
- `/login` — Login
- `/signup` — Sign up (customer or tradie)
- `/onboarding` — Multi-step tradie onboarding (6 steps)
- `/tradie/dashboard` — Tradie dashboard (stats, verification status, quick links)
- `/jobs` — Job list
- `/jobs/:jobId` — Job detail + chat messages
- `/admin` — Admin dashboard (stats + navigation)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (provisioned)
- `SESSION_SECRET` — Exists (legacy; JWT uses JWT_ACCESS_SECRET / JWT_REFRESH_SECRET with dev fallbacks)
- `STRIPE_SECRET_KEY` — Optional; without it, checkout is simulated
- `STRIPE_WEBHOOK_SECRET` — Optional
- `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_ANNUAL_PRICE_ID` — Stripe price IDs
- `APP_BASE_URL` — Production URL for Stripe redirect URLs
- `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` — Optional for file uploads

## Seed Accounts

Run `pnpm --filter @workspace/scripts run seed`:
- Admin: `admin@tradieafterdark.com.au` / `Admin1234!`
- Customer: `alice@example.com` / `Customer123!`
- Tradie: `mike.sparks@tradieafterdark.com.au` / `Tradie123!`

## Codegen

After editing `lib/api-spec/openapi.yaml`:
```
pnpm --filter @workspace/api-spec run codegen
# Then manually fix lib/api-zod/src/index.ts to only export from "./generated/api"
```
