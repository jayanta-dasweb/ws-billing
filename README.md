# Billing POS

Real-time retail / pharmacy billing: multi-counter POS, stock reservations (Redis), bill commit queue, GST invoices, RBAC, and a customer portal (purchase history & analytics).

## Tech stack

| Area | Technologies |
|------|----------------|
| **Frontend** | Next.js 15, React, Redux Toolkit, RTK Query, Bootstrap / AdminLTE |
| **Backend** | NestJS 11, Prisma, JWT + refresh cookies, Socket.IO |
| **Data** | MySQL 8, Redis 7, BullMQ |
| **Monorepo** | npm workspaces (`apps/backend`, `apps/frontend`, `packages/shared`) |
| **Deploy** | Docker Compose (MySQL, Redis, optional full stack + Nginx) |

## Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** (for MySQL + Redis — easiest path)

---

## Quick setup (~5 minutes)

For reviewers who want the app running locally with minimal steps.

### 1. Clone and install

```bash
git clone https://github.com/jayanta-dasweb/ws-billing.git
cd ws-billing
cp .env.example .env
npm install
```

### 2. Start database & cache

```bash
docker compose up -d mysql redis
```

Wait ~30 seconds for MySQL to be healthy (`docker compose ps`).

### 3. Database schema + demo data

```bash
npm run prisma:deploy
npm run prisma:seed -w @billing/backend
```

### 4. Run the app

```bash
npm run dev
```

Wait until you see the frontend on port **3000** and backend on **4000**.

---

## How to access (after `npm run dev`)

| What | URL |
|------|-----|
| **App home** (pick staff or customer) | http://localhost:3000 |
| **Staff login** | http://localhost:3000/login |
| **Billing counter (POS)** | http://localhost:3000/billing |
| **Admin dashboard** | http://localhost:3000/dashboard |
| **Customer sign-in** | http://localhost:3000/customer/login |
| **Swagger API docs** | http://localhost:4000/docs |
| **API base** | http://localhost:3000/api/v1 (proxied to backend in dev) |

> **Swagger** runs on the **backend** port (`4000`), not `3000`. Open http://localhost:4000/docs in the browser while `npm run dev` is running.

### Demo logins (after seed)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@123` | Super Admin → dashboard |
| `cashier1` | `Cashier@123` | Cashier → billing counter |

Customer portal: use a **registered customer mobile** from master data (created when billing with a real customer).

---

## Environment file

All config lives in **one file** at the repo root:

```bash
cp .env.example .env
```

The example file is ready to use with Docker Compose defaults (`billing` / `billing_secret` on MySQL). Do not commit `.env` — it is gitignored.

---

## Docker

### Option A — MySQL + Redis only (recommended for development)

Use with `npm run dev` on your machine (fastest for UI work):

```bash
cp .env.example .env
docker compose up -d mysql redis
npm install
npm run prisma:deploy
npm run prisma:seed -w @billing/backend
npm run dev
```

### Option B — Full stack in Docker

Builds and runs backend, frontend, MySQL, Redis, and Nginx:

```bash
cp .env.example .env
docker compose up -d --build
```

Then run migrations once (if the backend container did not apply them):

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx ts-node prisma/seed.ts
```

| URL | Description |
|-----|-------------|
| http://localhost | App via Nginx |
| http://localhost/api/v1 | API |
| http://localhost:4000/docs | Swagger (direct backend port) |

Stop everything:

```bash
docker compose down
```

---

## Useful commands

```bash
npm run dev              # Frontend :3000 + backend :4000
npm run build            # Production build
npm run docker:up        # docker compose up -d
npm run prisma:deploy    # Apply migrations (production-safe)
npm run prisma:seed -w @billing/backend   # Demo users & masters
```

---

## Project layout

.
├── ./ws-billing/                          # Monorepo root (npm workspaces)
├── ./├── .env.example                     # Env template → copy to .env
├── ./├── .gitignore
├── ./├── package.json                     # Root scripts: dev, build, docker, prisma
├── ./├── package-lock.json
├── ./├── docker-compose.yml               # MySQL, Redis, backend, frontend, nginx
├── ./├── ecosystem.config.js              # PM2 (production)
├── ./├── README.md
├── ./│
├── ./├── apps/
├── ./│   ├── backend/                     # NestJS API (:4000)
├── ./│   │   ├── Dockerfile
├── ./│   │   ├── package.json
├── ./│   │   ├── prisma/
├── ./│   │   │   ├── schema.prisma        # DB models
├── ./│   │   │   ├── seed.ts              # Demo users & masters
├── ./│   │   │   └── migrations/          # SQL migrations (versioned)
├── ./│   │   ├── scripts/                 # kill-port, smoke tests, clean
├── ./│   │   └── src/
├── ./│   │       ├── main.ts
├── ./│   │       ├── app.module.ts
├── ./│   │       ├── auth/                # Staff JWT login, refresh, guards
├── ./│   │       ├── billing/             # POS bills, lines, commit, payments
├── ./│   │       ├── customer-auth/       # Customer portal login, OTP reset
├── ./│   │       ├── common/              # Audit, filters, decorators, logger
├── ./│   │       ├── health/
├── ./│   │       ├── inventory/           # Stock adjustments, movements
├── ./│   │       ├── invoice/             # GST invoice JSON + PDF
├── ./│   │       ├── masters/             # CRUD: product, batch, customer, user…
├── ./│   │       ├── prisma/              # PrismaService module
├── ./│   │       ├── queue/               # BullMQ bill commit processor
├── ./│   │       ├── redis/               # Pending qty / reservations
├── ./│   │       ├── reports/
├── ./│   │       ├── returns/             # Sales returns
├── ./│   │       ├── security/            # RBAC, permissions, IP allowlist
├── ./│   │       ├── stock/               # Reservations, shortage alerts
├── ./│   │       └── websocket/           # Socket.IO billing events
├── ./│   │
├── ./│   └── frontend/                    # Next.js 15 UI (:3000)
├── ./│       ├── Dockerfile
├── ./│       ├── package.json
├── ./│       ├── next.config.ts
├── ./│       ├── public/                  # Icons, PWA, service worker
├── ./│       └── src/
├── ./│           ├── app/                 # App Router pages
├── ./│           │   ├── page.tsx         # Home (staff vs customer)
├── ./│           │   ├── login/           # Staff sign-in
├── ./│           │   ├── billing/         # Cashier POS
├── ./│           │   ├── (admin)/         # Admin layout group
├── ./│           │   │   ├── dashboard/
├── ./│           │   │   ├── masters/     # Products, users, roles…
├── ./│           │   │   └── inventory/   # Stock, returns, audit
├── ./│           │   └── customer/        # Customer portal
├── ./│           │       ├── login/
├── ./│           │       ├── dashboard/   # Purchase analytics
├── ./│           │       ├── invoices/    # List + [billId] detail
├── ./│           │       └── forgot-password/
├── ./│           ├── components/          # Reusable UI (auth, billing, customer…)
├── ./│           ├── config/              # adminNav.ts
├── ./│           ├── hooks/
├── ./│           ├── layouts/               # AdminLayout, BillingLayout
├── ./│           ├── lib/                 # apiBase, offline draft, customer PDF
├── ./│           ├── modules/             # Large screens (BillingScreen, modals)
├── ./│           ├── redux/               # store, auth, stock, RTK Query
├── ./│           ├── services/api/        # RTK endpoints per domain
├── ./│           ├── stores/              # Zustand billing UI state
├── ./│           ├── styles/              # customer-portal.css
├── ./│           ├── utils/               # permissions, roles, helpers
├── ./│           └── websocket/           # useBillingSocket
├── ./│
├── ./├── packages/
├── ./│   └── shared/                      # Shared TypeScript types/DTOs
├── ./│       └── src/                     # bill, invoice-api, permissions, audit…
├── ./│
├── ./├── docker/
├── ./│   └── mysql/                       # Init SQL grants
├── ./├── nginx/
├── ./│   └── nginx.conf                   # Reverse proxy (Docker full stack)
└── ./└── docs/
    └── ./└── docs/└── ARCHITECTURE.md              # Design notes

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 3000 / 4000 in use | Stop other processes or run `npm run dev` (kills ports automatically on Windows) |
| DB connection refused | `docker compose up -d mysql` and wait for healthy status |
| Prisma client error | `npm run prisma:generate` |
| Empty login | Run seed: `npm run prisma:seed -w @billing/backend` |

---

## License

Private / portfolio project — adjust as needed for your repository.
