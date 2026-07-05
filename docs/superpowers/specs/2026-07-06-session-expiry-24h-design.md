# Session Expiry — 24-Hour Absolute Limit

**Date:** 2026-07-06  
**Status:** Approved

## Goal

Enforce that all authenticated sessions expire exactly 24 hours after login, regardless of user activity. The current default (30 days) is too permissive for an HR system handling sensitive leave data.

## Scope

Single file: `src/lib/auth.ts`

## Changes

### `session` block

Add `maxAge` (cookie lifetime) and `updateAge: 0` (disables cookie refresh on activity):

```ts
session: {
  strategy: "jwt",
  maxAge: 24 * 60 * 60,  // 86400 s
  updateAge: 0,           // absolute expiry — never extend on activity
},
```

### `jwt` block (new)

Add a top-level `jwt` option with matching `maxAge` so the token itself also expires after 24 hours:

```ts
jwt: {
  maxAge: 24 * 60 * 60,
},
```

`jwt.maxAge` and `session.maxAge` must always be kept in sync; a mismatch would cause the cookie to outlive the token (or vice versa), leading to confusing auth failures.

## Behaviour

| Scenario | Result |
|---|---|
| User logs in | Session and JWT both expire 24 h later |
| User is active throughout the day | Session still expires 24 h from login (`updateAge: 0`) |
| User logs out and back in | New 24-hour window starts |
| Sessions created before this change | Expire when their original 30-day cookie expires or on manual logout |

## Out of Scope

- No changes to UI (no countdown or expiry warnings)
- No changes to database or Prisma schema
- No changes to any other file
