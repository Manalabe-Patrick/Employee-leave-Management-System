# Session Expiry — 24-Hour Absolute Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce that all new sessions expire exactly 24 hours after login with no rolling extension.

**Architecture:** Add `maxAge` and `updateAge` to the existing `session` block in the NextAuth config, and add a matching `jwt` top-level block. No other files change.

**Tech Stack:** Next.js (App Router), NextAuth v5 (Auth.js), TypeScript

## Global Constraints

- `maxAge` value must be `24 * 60 * 60` (expressed as the multiplication, not the literal `86400`, to keep intent readable)
- `jwt.maxAge` and `session.maxAge` must always be identical
- No changes outside `src/lib/auth.ts`
- TypeScript must compile cleanly after the change (`npx tsc --noEmit`)

---

### Task 1: Add 24-hour expiry to NextAuth config

**Files:**
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Produces: NextAuth config with `session.maxAge = 86400`, `session.updateAge = 0`, `jwt.maxAge = 86400`

- [ ] **Step 1: Open the file and locate the config object**

  The relevant section currently reads:

  ```ts
  export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },
  ```

- [ ] **Step 2: Apply the edit**

  Replace the `session` line and add the `jwt` block so the top of the config reads:

  ```ts
  export const { handlers, auth, signIn, signOut } = NextAuth({
    session: {
      strategy: "jwt",
      maxAge: 24 * 60 * 60,
      updateAge: 0,
    },
    jwt: {
      maxAge: 24 * 60 * 60,
    },
    pages: {
  ```

  The full file after the edit should be:

  ```ts
  import NextAuth from "next-auth";
  import Credentials from "next-auth/providers/credentials";
  import { compare } from "bcryptjs";
  import { db } from "@/lib/db";

  export const { handlers, auth, signIn, signOut } = NextAuth({
    session: {
      strategy: "jwt",
      maxAge: 24 * 60 * 60,
      updateAge: 0,
    },
    jwt: {
      maxAge: 24 * 60 * 60,
    },
    pages: {
      signIn: "/login",
    },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const rawEmail = credentials.email as string | undefined;
          const password = credentials.password as string | undefined;

          if (!rawEmail || !password) return null;

          const email = rawEmail.trim().toLowerCase();
          const user = await db.user.findUnique({ where: { email } });
          if (!user) return null;

          const isValid = await compare(password, user.password);
          if (!isValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            departmentId: user.departmentId,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.userId = user.id!;
          token.name = user.name!;
          token.role = user.role;
          token.departmentId = user.departmentId;
        }
        return token;
      },
      async session({ session, token }) {
        session.user.userId = token.userId;
        session.user.name = token.name;
        session.user.role = token.role;
        session.user.departmentId = token.departmentId;
        return session;
      },
    },
  });
  ```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

  Run:
  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors, no output. If there are errors, check that `jwt` is a valid top-level key in the installed version of `next-auth` — run `npx next-auth --version` to confirm the version and check `node_modules/next-auth/types.d.ts` for the `NextAuthConfig` interface.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/auth.ts
  git commit -m "feat: enforce 24-hour absolute session expiry"
  ```
