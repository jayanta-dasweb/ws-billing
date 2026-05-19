# Billing System — Architecture (Phase 1)

## Problem

Three billing counters may sell the same batch at the same time. Hard row locks during typing freeze counters and hurt throughput.

## Solution: Soft Reservation + FIFO Commit Queue

| Phase | Action | Stock impact |
|-------|--------|--------------|
| Typing | Add line items | Redis `pending_qty` only — no MySQL lock |
| Complete | Enqueue BullMQ job | Worker runs `SELECT ... FOR UPDATE` (milliseconds) |
| Commit | Validate `stock_qty - pending_qty` | Deduct stock or mark `FAILED_STOCK` |

**Why Redis for pending?** Sub-millisecond increments; websocket broadcast to all counters without touching MySQL.

**Why BullMQ FIFO (concurrency 1)?** Ordered commits per queue worker avoid race on same batch; horizontal scale = more workers on partitioned queues later.

**Why not lock while typing?** Billing speed is top priority; overselling is prevented only at commit.

## Monorepo Layout

```
billing/
├── apps/backend/     NestJS API, Prisma, BullMQ, Socket.IO
├── apps/frontend/    Next.js App Router, AdminLTE, Redux, Zustand
├── packages/shared/  Enums, WS events, API types
├── nginx/            Reverse proxy + websocket upgrade
└── docker-compose.yml
```

## ER Overview

```
Company ──< Invoice >── Bill ──< BillItem >── Product
                          │              └── BatchStock
User ──< Bill              Customer
Counter ──< Bill
TaxMaster ──< Product
```

## Key Indexes (Prisma)

- `products.barcode` — scan speed
- `batch_stock(product_id, batch_number)` — batch lookup
- `bills(status)`, `bills(counter_id, status)` — counter queue views
- `invoices.invoice_no` — reprint lookup

## WebSocket Events (`/billing` namespace)

Defined in `@billing/shared`: `stock_pending_updated`, `stock_committed`, `stock_failed`, `bill_completed`, `counter_online`, `queue_status_updated`.

## API Response Envelope

```json
{
  "success": true,
  "message": "OK",
  "data": { },
  "timestamp": "2026-05-17T..."
}
```

## Phase Roadmap

| Phase | Scope |
|-------|--------|
| 1 ✅ | Infra, Docker, Prisma schema, Redis, BullMQ skeleton, WS gateway |
| 2 | JWT auth, refresh rotation, silent retry, RBAC |
| 3 | Master CRUD (company, user, counter, customer, product, batch, tax, payment) |
| 4 | Billing engine — pending API, complete bill, queue worker |
| 5 ✅ | GST invoice PDF (PDFKit), A4 + thermal HTML print, F7 reprint |
| 6 ✅ | IndexedDB draft recovery, offline action queue, service worker shell cache |

## Run Locally

```bash
cp .env.example .env
npm install
docker compose up -d mysql redis
npm run prisma:migrate
npm run dev
```

- Frontend: http://localhost:3000  
- API/Swagger: http://localhost:4000/docs  
- Health: http://localhost:4000/api/v1/health  
