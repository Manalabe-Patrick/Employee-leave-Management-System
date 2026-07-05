# Phase 2: Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login, registration, and route protection to the leave management system using NextAuth.js v5 with Credentials provider and JWT strategy.

**Architecture:** NextAuth.js v5 configured with a Credentials provider that validates email/password against the Prisma User table. JWT strategy — token carries userId, role, and departmentId. Route protection via Next.js 16 `proxy.ts` (not `middleware.ts`) using `getToken()` from `next-auth/jwt` to decode the JWT without a DB call. Client-side login page uses `signIn()` from `next-auth/react`. Registration is a standalone API route.

**Tech Stack:** Next.js 16.2.9 (App Router), NextAuth.js v5 (beta.31), Prisma 7.8, bcryptjs 3.x, shadcn/ui (base-nova style), TypeScript

## Global Constraints

- Next.js 16: `middleware.ts` is deprecated — use `proxy.ts` with named export `proxy`
- NextAuth v5: import `NextAuth` as default from `"next-auth"`, credentials from `"next-auth/providers/credentials"`, client `signIn` from `"next-auth/react"`, `getToken` from `"next-auth/jwt"`
- Prisma client import: `import { PrismaClient } from "@/generated/prisma/client"` — client is generated to `src/generated/prisma`
- Database singleton: `import { db } from "@/lib/db"` — already exists
- shadcn/ui style: `base-nova` with `@base-ui/react` primitives (not radix). Add components via `npx shadcn@latest add <name>`
- Role enum values: `EMPLOYEE`, `MANAGER`, `HR` — from Prisma schema
- Passwords: bcryptjs with 10 salt rounds (matching seed.ts)
- TypeScript path alias: `@/` maps to `src/`

---

### Task 1: Add shadcn/ui Components + Type Augmentation + Environment

**Files:**
- Create: `src/types/next-auth.d.ts`
- Scaffold: `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx` (via shadcn CLI)

**Interfaces:**
- Consumes: nothing
- Produces: shadcn `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` from `@/components/ui/card`; `Input` from `@/components/ui/input`; `Label` from `@/components/ui/label`; augmented `Session["user"]` and `JWT` types with `userId: string`, `role: "EMPLOYEE" | "MANAGER" | "HR"`, `departmentId: string | null`

- [ ] **Step 1: Add shadcn/ui components**

Run:
```bash
npx shadcn@latest add card input label
```

Expected: Three new files appear under `src/components/ui/`. No errors.

- [ ] **Step 2: Verify components were added**

Run:
```bash
ls src/components/ui/
```

Expected: `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`

- [ ] **Step 3: Create NextAuth type augmentation**

Create `src/types/next-auth.d.ts`:

```ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "EMPLOYEE" | "MANAGER" | "HR";
    departmentId: string | null;
  }

  interface Session {
    user: {
      userId: string;
      email: string;
      role: "EMPLOYEE" | "MANAGER" | "HR";
      departmentId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
    departmentId: string | null;
  }
}
```

- [ ] **Step 4: Create `.env.local` with auth variables**

Create `.env.local` (if it doesn't exist, or append to it):

```
NEXTAUTH_SECRET=dev-secret-change-in-production-at-least-32-chars
NEXTAUTH_URL=http://localhost:3000
```

The `DATABASE_URL` should already be in `.env` from Phase 1.

- [ ] **Step 5: Verify the project compiles**

Run:
```bash
npx next build 2>&1 | head -20
```

Expected: No TypeScript errors related to the new files. Build may fail due to missing auth config (that's Task 2), but there should be no type errors from the `.d.ts` file.

- [ ] **Step 6: Commit**

```bash
git add src/types/next-auth.d.ts src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/label.tsx
git commit -m "feat(auth): add NextAuth type augmentation and shadcn/ui form components"
```

---

### Task 2: NextAuth.js Configuration + Route Handler

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`; `User` model via Prisma; `bcryptjs` for password comparison
- Produces: `auth()` — returns `Promise<Session | null>` for server-side session access; `signIn()` — server-side sign in; `signOut()` — server-side sign out; `handlers` — `{ GET, POST }` for the route handler

- [ ] **Step 1: Create NextAuth configuration**

Create `src/lib/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
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
        const email = credentials.email as string | undefined;
        const password = credentials.password as string | undefined;

        if (!email || !password) return null;

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
        token.role = user.role;
        token.departmentId = user.departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId;
      session.user.role = token.role;
      session.user.departmentId = token.departmentId;
      return session;
    },
  },
});
```

- [ ] **Step 2: Create route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
export { handlers as GET, handlers as POST } from "@/lib/auth";
```

Wait — that's wrong. The `handlers` object has `GET` and `POST` properties. The correct export is:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Verify the auth API endpoint responds**

Run the dev server:
```bash
npx next dev &
sleep 5
curl -s http://localhost:3000/api/auth/providers | head -5
```

Expected: JSON response listing the "credentials" provider.

Kill the dev server after verifying.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/\[\...nextauth\]/route.ts
git commit -m "feat(auth): configure NextAuth.js with credentials provider and JWT strategy"
```

---

### Task 3: Registration API Route

**Files:**
- Create: `src/app/api/auth/register/route.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`; `bcryptjs` for password hashing
- Produces: `POST /api/auth/register` — accepts `{ email, password, firstName, lastName }`, returns `201` with `{ id, email, firstName, lastName }` on success; `400` on validation failure; `409` on duplicate email

- [ ] **Step 1: Create the registration route handler**

Create `src/app/api/auth/register/route.ts`:

```ts
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, firstName, lastName } = body;

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  const hashedPassword = await hash(password, 10);

  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
    },
  });

  return NextResponse.json(
    { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    { status: 201 }
  );
}
```

- [ ] **Step 2: Test the registration endpoint**

With the dev server running:
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","firstName":"Test","lastName":"User"}'
```

Expected: `201` response with `{ "id": "...", "email": "test@test.com", "firstName": "Test", "lastName": "User" }`.

Test duplicate:
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","firstName":"Test","lastName":"User"}'
```

Expected: `409` response with `{ "error": "Email already registered" }`.

Test missing fields:
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@test.com"}'
```

Expected: `400` response with `{ "error": "All fields are required" }`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat(auth): add user registration API endpoint"
```

---

### Task 4: Auth Layout + Login Page

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `signIn` from `next-auth/react` (client-side); `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` from `@/components/ui/card`; `Input` from `@/components/ui/input`; `Label` from `@/components/ui/label`; `Button` from `@/components/ui/button`
- Produces: `/login` page — renders email/password form, calls `signIn("credentials", ...)`, redirects to `/dashboard` on success

- [ ] **Step 1: Create the auth layout**

Create `src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {registered && (
            <p className="text-sm text-green-600">
              Account created successfully. Please log in.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary underline">
              Register
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Test the login page renders**

With the dev server running, open `http://localhost:3000/login` in a browser.

Expected: Centered card with email and password fields, "Sign in" button, and link to Register.

- [ ] **Step 4: Test login with the seeded HR user**

On the login page, enter:
- Email: `admin@company.com`
- Password: `admin123`

Click "Sign in".

Expected: Redirected to `/dashboard` (which may show a 404 — that's fine, the redirect is what matters). Check browser DevTools > Application > Cookies for a `next-auth.session-token` cookie.

- [ ] **Step 5: Test login with wrong credentials**

Enter wrong password and click "Sign in".

Expected: "Invalid email or password" error message appears inline.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\)/layout.tsx src/app/\(auth\)/login/page.tsx
git commit -m "feat(auth): add auth layout and login page with credentials sign-in"
```

---

### Task 5: Register Page

**Files:**
- Create: `src/app/(auth)/register/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/register` from Task 3; `Card`, `Input`, `Label`, `Button` from shadcn/ui
- Produces: `/register` page — renders registration form, calls the register API, redirects to `/login?registered=1` on success

- [ ] **Step 1: Create the register page**

Create `src/app/(auth)/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>Create a new employee account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 2: Test the register page renders**

Open `http://localhost:3000/register` in a browser.

Expected: Centered card with first name, last name, email, password fields, "Create account" button, and link to Login.

- [ ] **Step 3: Test registration flow end-to-end**

Fill out the form with valid data (e.g., `newuser@test.com`, `password123`, `New`, `User`) and click "Create account".

Expected: Redirected to `/login?registered=1`, which shows the success message "Account created successfully. Please log in."

- [ ] **Step 4: Test registration with duplicate email**

Register again with the same email.

Expected: Inline error "Email already registered".

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/register/page.tsx
git commit -m "feat(auth): add registration page with form validation"
```

---

### Task 6: Route Protection (Proxy) + Dashboard Placeholder

**Files:**
- Create: `src/proxy.ts`
- Create: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getToken` from `next-auth/jwt`; `NextRequest`, `NextResponse` from `next/server`
- Produces: Route protection — unauthenticated users redirected to `/login`; authenticated users on `/login` or `/register` redirected to `/dashboard`; root `/` redirects appropriately; `/dashboard` placeholder page for redirect target

- [ ] **Step 1: Create the proxy file**

Create `src/proxy.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const authPages = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request });

  if (!token && !authPages.includes(pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token && authPages.includes(pathname)) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  if (pathname === "/") {
    const target = token ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Create dashboard placeholder page**

Create `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome, {session.user.email} ({session.user.role})
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Test unauthenticated redirect**

Clear cookies (or use incognito). Navigate to `http://localhost:3000/dashboard`.

Expected: Redirected to `/login`.

- [ ] **Step 4: Test authenticated redirect away from login**

Log in with `admin@company.com` / `admin123`. Then navigate to `http://localhost:3000/login`.

Expected: Redirected to `/dashboard`.

- [ ] **Step 5: Test root redirect**

Navigate to `http://localhost:3000/`.

Expected: Redirected to `/dashboard` (if authenticated) or `/login` (if not).

- [ ] **Step 6: Test full flow end-to-end**

1. Clear cookies
2. Visit `/dashboard` → redirected to `/login`
3. Click "Register" → go to `/register`
4. Fill out form → submit → redirected to `/login?registered=1`
5. Login with new credentials → redirected to `/dashboard`
6. Dashboard shows "Welcome, your@email.com (EMPLOYEE)"

- [ ] **Step 7: Commit**

```bash
git add src/proxy.ts src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(auth): add route protection via proxy and dashboard placeholder"
```

---

## Verification Checklist

After all tasks are complete, verify these scenarios one final time:

1. `GET /` (unauthenticated) → redirects to `/login`
2. `GET /` (authenticated) → redirects to `/dashboard`
3. `GET /login` (authenticated) → redirects to `/dashboard`
4. `GET /dashboard` (unauthenticated) → redirects to `/login`
5. Register new user → redirects to `/login` with success message
6. Register duplicate email → shows "Email already registered" inline
7. Login with valid credentials → redirects to `/dashboard`
8. Login with wrong password → shows "Invalid email or password" inline
9. Login with seeded HR user (`admin@company.com` / `admin123`) → dashboard shows role "HR"
10. `GET /api/auth/providers` → returns JSON with credentials provider (even when unauthenticated)
