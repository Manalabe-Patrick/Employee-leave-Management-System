# Security Headers Design

**Date:** 2026-07-06
**Status:** Approved

## Goal

Add five standard HTTP security headers to every route in the Next.js app via the `headers()` async function in `next.config.ts`.

## Scope

- Single file change: `next.config.ts`
- No new files, no middleware, no dependencies

## Approach

One `headers()` rule with `source: '/:path*'` covers all routes — pages, API routes, static assets served through Next.js. This is the idiomatic Next.js pattern for app-wide static headers.

## Headers

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing; blocks content-type confusion attacks |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking by blocking cross-origin iframe embedding |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Enforces HTTPS for 2 years across all subdomains; `preload` omitted intentionally |
| `X-XSS-Protection` | `1; mode=block` | Legacy reflected-XSS filter for older browsers; modern browsers use CSP |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends full URL same-origin, only origin cross-origin HTTPS, nothing on HTTP downgrade |

### HSTS note

`preload` is deliberately excluded from the `Strict-Transport-Security` value. Preload submission to browser preload lists is irreversible on short timescales and should be a conscious, separate decision made after the domain is stable on HTTPS.

## Resulting `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options",      value: "nosniff" },
          { key: "X-Frame-Options",              value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security",    value: "max-age=63072000; includeSubDomains" },
          { key: "X-XSS-Protection",             value: "1; mode=block" },
          { key: "Referrer-Policy",              value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

## Out of Scope

- Content-Security-Policy (separate, more complex header — worth a dedicated design)
- Permissions-Policy
- HSTS preload submission
