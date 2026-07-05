# Security Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five HTTP security headers to every route in the app via `next.config.ts`.

**Architecture:** A single `async headers()` function is added to the `NextConfig` object. It returns one rule matching `/:path*` (all routes) with five header key/value pairs. No middleware, no new files, no dependencies.

**Tech Stack:** Next.js 16.2.9, TypeScript

## Global Constraints

- Only `next.config.ts` is modified — no other files touched
- No git commit step — user commits manually
- `preload` directive must NOT be added to `Strict-Transport-Security`

---

### Task 1: Add `headers()` to `next.config.ts`

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Produces: HTTP response headers on every route — verified by inspecting response headers from the dev server

- [ ] **Step 1: Open `next.config.ts` and confirm its current content**

The file currently contains:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

- [ ] **Step 2: Replace the file content with the headers implementation**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "X-Frame-Options",           value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-XSS-Protection",          value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Start the development server**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000` with no errors.

- [ ] **Step 4: Verify headers are present on a page route**

```bash
curl -I http://localhost:3000/
```

Expected output includes all five headers:

```
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
strict-transport-security: max-age=63072000; includeSubDomains
x-xss-protection: 1; mode=block
referrer-policy: strict-origin-when-cross-origin
```

- [ ] **Step 5: Verify headers are present on an API route**

```bash
curl -I http://localhost:3000/api/auth/session
```

Expected: same five headers appear in the response.

- [ ] **Step 6: Stop the dev server**

Press `Ctrl+C` in the terminal running the dev server.
