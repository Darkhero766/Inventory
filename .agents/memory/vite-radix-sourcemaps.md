---
name: Vite and Radix sourcemap compatibility
description: Production Rollup sourcemap diagnostics caused by Next.js directives in Vite-only Radix wrappers.
---

In this Vite app, a directly imported Radix wrapper containing a module-level `'use client'` directive can trigger Rollup `SOURCEMAP_ERROR` diagnostics even when production bundle sourcemaps are disabled. Vite does not need the directive because the entire app is already client-rendered.

**Why:** The directive is a framework boundary marker for Next.js, not a runtime requirement for Radix or React. Rollup parses it as a module-level expression and can fail to map the transformed location.

**How to apply:** Keep `build.sourcemap` disabled for production while preserving it for non-production modes, gate Replit dev/debug plugins on `mode !== 'production'`, and remove Next-only module directives from Vite-only wrappers that are included in the production bundle.