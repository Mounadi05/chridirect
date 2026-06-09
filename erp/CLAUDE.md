# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ChriDirect ERP** is a full-stack logistics/warehouse ERP for e-commerce order fulfillment. It integrates with the **ChriDirect Store** and **Sendit** (delivery service) to manage orders, inventory, staff assignments, and deliveries — built for ChriDirect, a Moroccan e-commerce business.

## Commands

### Database (PostgreSQL via Docker)
The DB runs in a container defined by `docker-compose.yml` (user/pass/db = `mounadi05` / `passtoM05` / `sendflow`, bound to `127.0.0.1:5432`).
```bash
docker compose up -d        # start Postgres
docker compose down         # stop (data persists in ./pgdata)
```

### Backend (Flask / Python 3.14)
```bash
# Run dev server on http://localhost:5000 (set FLASK_DEBUG=1 for reload)
python run.py

# Seed default admin/staff users (script lives at REPO ROOT, not scripts/)
python initDatabase.py
```
There is **no migration workflow** — `create_app()` calls `db.create_all()` on every startup, so new models/columns appear automatically (existing columns are never altered). `Flask-Migrate` is in requirements.txt but there is no `migrations/` directory and no `flask db` setup.

### Frontend (Next.js / Node)
```bash
cd frontend
npm run dev      # dev server, --hostname 0.0.0.0, port 3000
npm run build    # production build
npm run lint     # eslint .
```

### No test suite
No automated tests exist (and `scripts/` is empty). Verify changes by running the app, inspecting the DB, or `curl`-ing Flask routes directly.

## Environment Setup

`.env` is **not committed** (gitignored) and must be created at the repo root. Without it the app crashes at startup with `Either 'SQLALCHEMY_DATABASE_URI' or 'SQLALCHEMY_BINDS' must be set` because `DATABASE_URL` resolves to `None`.

Env vars actually read by `config.py` (note: names differ from typical conventions):
- `DATABASE_URL` (required) — e.g. `postgresql://mounadi05:passtoM05@localhost:5432/sendflow`
- `FLASK_SECRET_KEY`, `FLASK_DEBUG`, `PORT`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `YOUCAN_TOKEN`, `YOUCAN_CLIENT_SECRET` (used for webhook HMAC verification)
- `SENDIT_PUBLIC_KEY`, `SENDIT_PRIVATE_KEY`, `SENDIT_BASE_URL`, `SENDIT_COMMENT_TEMPLATE`
- `FRONTEND_URL`

Frontend: `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000`. `lib/api.ts` reads this; all requests use `credentials: "include"`, and Flask CORS is hardcoded to allow only `http://localhost:3000`.

## Architecture

### Request flow
```
Browser → Next.js (port 3000)
            ↓ fetch() via lib/api.ts  (credentials: include)
         Flask API (port 5000)
            ↓ SQLAlchemy
         PostgreSQL (Docker)
            ↓ requests library
         YouCan API / Sendit API
```

### Backend structure
`app/__init__.py` is the app factory — it registers blueprints, configures CORS, and runs `db.create_all()`. Each feature domain is a Flask Blueprint in `app/routes/`:

| Blueprint | Prefix | Responsibility |
|-----------|--------|----------------|
| `auth_routes` | `/auth` | Google OAuth 2.0 flow |
| `order_routes` | `/api/orders` | YouCan sync, CRUD, staff assignment, rebalance |
| `user_routes` | `/api/users` | Staff/admin management, heartbeat/availability |
| `customer_routes` | `/api/customers` | Customer profiles, blacklisting |
| `inventory_routes` | `/api/inventory` | SKU catalog, auto-linking to orders |
| `webhook_routes` | `/api/webhooks` | YouCan real-time order ingestion |
| `sendit_routes` | `/api/sendit` | Delivery shipment creation + tracking proxy |
| `settings_routes` | `/api/settings` | `AppSetting` key-value CRUD |
| `analytics_routes` | `/api/analytics` | Dashboard metrics |
| `color_routes` | `/api/colors` | Color reference data |
| `blacklist_brand_routes` | `/api/blacklisted-brands` | Brand blacklist |
| `finances_routes` | `/api/finances` | Payouts, margins, ad spend |

⚠️ `business_control_routes.py` defines a `business_control_bp` blueprint but it is **not registered** in `app/__init__.py` — its routes are currently dead/unreachable. Register it if you intend to use it.

`app/models.py` defines all models. `app/utils.py` holds shared logic: YouCan webhook HMAC signature verification (`verify_youcan_signature`), variant normalization (`normalize_variant`), status mapping, and fuzzy product matching for inventory linking (`fuzzy_match_product`). `app/distribution.py` handles round-robin order distribution.

### Frontend structure
Next.js App Router. Two dashboard roots gate on user role:
- `components/admin-dashboard.tsx` — full control: orders, analytics, team, settings, finances
- `components/staff-dashboard.tsx` — limited view: assigned orders + unassigned pool

`lib/api.ts` is the single source of truth for all API calls **and** TypeScript type definitions — route every new `fetch()` through here. State management uses **TanStack React Query** (`lib/queryClient.ts`). The `@/*` TS alias maps to the `frontend/` root.

### Key data flows

**Order ingestion:** YouCan orders enter via `POST /api/orders/sync` (manual admin trigger) or `POST /api/webhooks/youcan` (real-time webhook, HMAC-verified with `YOUCAN_CLIENT_SECRET`). Both normalize items and fuzzy-match them to inventory SKUs via `utils.py`.

**Order distribution (`distribution.py`):** A debounced background `threading.Timer` calls `distribute_pool()`, which round-robins **pool orders** (`staff_id IS NULL AND order_status IS NULL AND is_completed = False`) across staff that are `is_active AND is_available`, ordered by `User.id`. The debounce delay depends on the trigger: **1s** from a webhook, **5s** from order creation, **30s** from the user heartbeat. `rebalance_assigned()` (admin-triggered) reassigns already-assigned-but-unstarted orders across currently available staff, returning them to the pool if no staff are available.

**Inventory auto-linking:** When new inventory is created, `inventory_routes.py` re-runs fuzzy matching over existing unmatched order items and links them retroactively.

**Delivery lifecycle:** Orders → Sendit API creates shipment + label → Sendit webhooks update delivery status → failed deliveries flow to `AdminReturns.tsx` (and `SenditReturn` rows) for restocking.

### Database models (`app/models.py`)
Tables: `users`, `inventory`, `customers`, `orders`, `order_details`, `order_items`, `deliveries`, `app_settings`, `colors`, `sendit_returns`, `blacklisted_brands`, `ad_spend`, `staff_payouts`.

Key relationships and conventions:
- `Order` → `Customer` (many-to-one), `User` as staff via `staff_id` (many-to-one), `OrderItem[]` (one-to-many), `Delivery` (one-to-one).
- An order is in the **unassigned pool** when `staff_id IS NULL AND order_status IS NULL` — these are the columns the distribution logic keys off of.
- `OrderItem` → `Inventory` (many-to-one, **nullable** — unmatched items have no inventory link).
- `Delivery` stores the Sendit tracking code and status history.
- `AppSetting` is a key-value table (`key`/`value`) for runtime config (e.g. app start date, webhook URLs); read it via `AppSetting.query.get(key)`.
