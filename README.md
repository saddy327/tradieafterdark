# TradieAfterDark

Australia's after-hours trade service marketplace. Connects verified tradies with customers for evening and weekend jobs.

## Tech Stack

- **Frontend** (`apps/frontend`): React 18, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter
- **Backend** (`apps/backend`): Express, TypeScript, pino
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (httpOnly cookies) — 15min access token, 30d refresh token
- **Payments**: Stripe subscriptions (dev mode simulates without a key)

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 14+

---

## Setup

### 1. Install pnpm

```bash
npm install -g pnpm
```

### 2. Install PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
```

Add the PostgreSQL binaries to your PATH if `psql` isn't found:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 3. Clone and install dependencies

```bash
git clone <repo-url>
cd tradieafterdark
pnpm install
```

### 4. Create the database

```bash
createdb tradieafterdark
```

### 5. Configure environment variables

Create `apps/backend/.env`:

```env
PORT=8080
DATABASE_URL=postgresql://<your-mac-username>@localhost:5432/tradieafterdark
JWT_ACCESS_SECRET=dev-access-secret-change-in-prod
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-prod
```

Create `apps/frontend/.env`:

```env
PORT=5173
BASE_PATH=/
```

### 6. Run database migrations

```bash
DATABASE_URL=postgresql://<your-mac-username>@localhost:5432/tradieafterdark pnpm --filter @workspace/db run push
```

### 7. Seed the database

```bash
DATABASE_URL=postgresql://<your-mac-username>@localhost:5432/tradieafterdark pnpm --filter @workspace/scripts run seed
```

This creates the following test accounts:

| Role     | Email                              | Password      |
|----------|------------------------------------|---------------|
| Admin    | admin@tradieafterdark.com.au       | Admin1234!    |
| Customer | alice@example.com                  | Customer123!  |
| Tradie   | mike.sparks@tradieafterdark.com.au | Tradie123!    |

---

## Running the app

Open two terminal tabs.

**Terminal 1 — Backend** (runs on port 8080):

```bash
pnpm --filter @workspace/backend run dev
```

**Terminal 2 — Frontend** (runs on port 5173):

```bash
pnpm --filter @workspace/frontend run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
apps/
  backend/        Express + TypeScript API server (port 8080)
  frontend/       React + Vite frontend (port 5173)
lib/
  db/             Drizzle ORM schema, migrations, pg pool
  api-spec/       OpenAPI 3.1 spec + orval codegen config
  api-zod/        Generated Zod schemas from OpenAPI spec
  api-client-react/  Generated TanStack Query hooks
scripts/
  src/seed.ts     Database seeder
```

## Optional: Stripe payments

Without `STRIPE_SECRET_KEY` set, checkout is simulated in dev mode. To enable real payments, add to `apps/backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...
APP_BASE_URL=http://localhost:5173
```

## Optional: File uploads (Cloudinary)

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```
