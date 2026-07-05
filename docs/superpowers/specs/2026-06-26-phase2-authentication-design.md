# Phase 2: Authentication (Login + Register) — Design Spec

**Date:** 2026-06-26
**Status:** Approved
**Parent Spec:** `docs/superpowers/specs/2026-06-25-employee-leave-management-system-design.md`
**Master Plan Phase:** Phase 2

## Overview

Add authentication to the leave management system using NextAuth.js v5 with Credentials provider and JWT strategy. Produces login and register pages, a registration API endpoint, route protection via Next.js 16 proxy, and TypeScript type augmentation for the session.

## Approach

NextAuth.js v5 (beta.31) with Credentials provider, already installed. JWT strategy — no database sessions, no session table. Token carries `userId`, `email`, `role`, `departmentId`. Route protection via `src/proxy.ts` (Next.js 16 convention, not `middleware.ts`).

## NextAuth.js Configuration

**File:** `src/lib/auth.ts`

- Credentials provider accepting `email` and `password`
- Looks up user in Prisma `User` table by email
- Verifies password with `bcrypt.compare`
- JWT strategy (no database adapter for sessions)
- JWT callback: on sign-in, embeds `userId`, `role`, `departmentId` into the token
- Session callback: exposes `userId`, `role`, `departmentId` on the session object
- Exports `auth()`, `signIn()`, `signOut()`, and the route handlers

**Route handler:** `src/app/api/auth/[...nextauth]/route.ts` — exports `GET` and `POST` from the auth config.

**Type augmentation:** `src/types/next-auth.d.ts` — extends NextAuth `Session` and `JWT` types to include `userId`, `role`, `departmentId`.

**Environment variables:**
- `NEXTAUTH_SECRET` — random string for JWT signing
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev
- `DATABASE_URL` — already exists from Phase 1

## Register API Route

**File:** `src/app/api/auth/register/route.ts`

POST endpoint that:
- Accepts JSON: `{ email, password, firstName, lastName }`
- Validates input server-side: all fields required, email format, password min 8 chars
- Checks for duplicate email — returns 409 if exists
- Hashes password with bcrypt (10 rounds)
- Creates user with `role: EMPLOYEE`, no department
- Returns 201 with `{ id, email, firstName, lastName }` — never exposes password hash
- No auto-login after registration — user redirected to login page

No validation library (Zod, etc.) — straightforward checks in the route handler.

## Auth Pages

### Route Group Layout

**File:** `src/app/(auth)/layout.tsx`

Minimal centered layout — no sidebar, no header. Content vertically and horizontally centered on a neutral background. Used by both login and register pages.

### Login Page

**File:** `src/app/(auth)/login/page.tsx`

- Client Component (uses `useActionState` for form feedback)
- Card with email input, password input, submit button
- Calls `signIn("credentials", { email, password, redirect: false })`
- On success: `router.push("/dashboard")`
- On failure: inline error message ("Invalid email or password")
- Link to `/register` ("Don't have an account? Register")

### Register Page

**File:** `src/app/(auth)/register/page.tsx`

- Client Component
- Card with first name, last name, email, password inputs, submit button
- Calls `POST /api/auth/register`
- On success: redirects to `/login` with success message via URL search param
- On failure: inline error messages from API response
- Link to `/login` ("Already have an account? Login")

### UI Components

Uses shadcn/ui primitives: `Button` (already installed), `Card`, `Input`, `Label` (to be added).

## Route Protection

**File:** `src/proxy.ts`

Next.js 16 proxy convention (renamed from `middleware.ts`). Named export `proxy`.

**Logic:**
- Uses `getToken()` from `next-auth/jwt` to decode JWT from request cookies (no DB call)
- No token + protected path → redirect to `/login`
- Has token + auth path (`/login`, `/register`) → redirect to `/dashboard`
- Root `/` → redirect to `/dashboard` (authenticated) or `/login` (unauthenticated)

**Matcher config:**
```
/((?!api/auth|_next/static|_next/image|favicon.ico).*)
```

Excludes:
- `/api/auth/*` — NextAuth handlers and register route, always accessible
- `_next/static`, `_next/image`, `favicon.ico` — static assets

All other routes (including non-auth API routes) are matched by the proxy. API route authorization is handled per-route in later phases; the proxy handles page-level redirects.

## Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth config (credentials provider, JWT callbacks) |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler (GET, POST) |
| `src/app/api/auth/register/route.ts` | Registration endpoint |
| `src/app/(auth)/layout.tsx` | Centered layout for auth pages |
| `src/app/(auth)/login/page.tsx` | Login form (Client Component) |
| `src/app/(auth)/register/page.tsx` | Register form (Client Component) |
| `src/proxy.ts` | Route protection |
| `src/types/next-auth.d.ts` | Type augmentation for Session/JWT |

**shadcn/ui components to add:** Card, Input, Label

**No schema changes** — uses existing User model from Phase 1.

## Test Plan

1. Register a new account → redirected to `/login`
2. Login with that account → redirected to `/dashboard`
3. Visit `/dashboard` without auth → redirected to `/login`
4. Visit `/login` while authenticated → redirected to `/dashboard`
5. Register with duplicate email → 409 error shown inline
6. Login with wrong password → error shown inline
