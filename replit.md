# Electronics Inventory

A private premium electronics catalog and inventory manager for tracking products, stock movements, purchases, and counter sales.

## Run & Operate

- `pnpm --filter @workspace/electronics-inventory run dev` — run the Vite app through the managed preview workflow
- `pnpm --filter @workspace/api-server run dev` — run the shared API server when backend work is needed
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/electronics-inventory/src/App.tsx` — routes, page-level UI, and inventory mutations
- `artifacts/electronics-inventory/src/lib/inventory.ts` — product seed data, INR formatting, stock status rules, and localStorage helpers
- `artifacts/electronics-inventory/src/components/inventory-shell.tsx` — responsive sidebar/mobile navigation shell
- `artifacts/electronics-inventory/src/components/product-card.tsx` — reusable product imagery, fallback state, cards, and status pills
- `artifacts/electronics-inventory/src/index.css` — theme tokens, responsive shell, shadows, motion, and image surfaces

## Architecture decisions

- Product, stock history, purchases, and sales are persisted in browser localStorage, matching the private single-workspace requirement.
- Stock mutations flow through one inventory context so purchases increase quantities and completed sales decrease them consistently.
- Product images use contained remote imagery with an in-app placeholder fallback when an image cannot load.
- The product surface is intentionally catalog-like: cards and compact ledgers are used instead of ERP-style dense tables.

## Product

- Home dashboard with searchable catalog, category shortcuts, stock summaries, low-stock/recent/popular views
- Inventory grid with search, category/brand/status filters, sorting, and add/edit product flows
- Product detail with pricing, margin, stock actions, warranty, and stock movement history
- Purchases that update stock and a counter-friendly sales POS with discounts and payment method selection
- Responsive desktop sidebar and mobile bottom navigation; English copy and ₹ INR pricing

## User preferences

- Keep the experience premium, minimalist, spacious, and image-led rather than administrative or ecommerce-oriented.
- Keep the interface English-only and all prices in Indian rupees.

## Gotchas

- The Vite build expects `PORT` and `BASE_PATH` from the managed workflow; prefer the artifact workflow for preview verification.
- Seed data initializes only when the relevant localStorage keys are absent; clear browser storage to restore the original demo catalog.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
