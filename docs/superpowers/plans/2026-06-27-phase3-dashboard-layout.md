# Phase 3: Dashboard Layout & Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared dashboard layout with collapsible sidebar, header bar with user menu, and role-based navigation to the leave management system.

**Architecture:** shadcn's `Sidebar` component (`collapsible="icon"` mode) provides the collapsible sidebar with automatic mobile sheet overlay. A `SidebarProvider` wraps all `(dashboard)` routes in a shared layout. The layout is a Server Component that calls `auth()` and passes user data as props to Client Component children (`AppSidebar`, `Header`). The `Header` contains a `SidebarTrigger` toggle, page title, and a `DropdownMenu` for the user menu with logout. Navigation links are filtered by the user's role.

**Tech Stack:** Next.js 16.2.9 (App Router), NextAuth.js v5 (beta.31), shadcn/ui (base-nova style with `@base-ui/react` primitives), Tailwind CSS v4, lucide-react, TypeScript

## Global Constraints

- Next.js 16: `middleware.ts` is deprecated — use `proxy.ts` with named export `proxy`
- NextAuth v5: `auth()` for server-side session; `signOut` from `next-auth/react` for client-side logout
- Prisma client import: `import { PrismaClient } from "@/generated/prisma/client"` — client generated to `src/generated/prisma`
- Database singleton: `import { db } from "@/lib/db"`
- shadcn/ui style: `base-nova` with `@base-ui/react` primitives (not radix). Add components via `npx shadcn@latest add <name>`
- Role enum values: `EMPLOYEE`, `MANAGER`, `HR` — from Prisma schema
- TypeScript path alias: `@/` maps to `src/`
- `SidebarMenuButton` uses `render` prop for custom elements: `render={<Link href="/path" />}` (base-ui convention, NOT `asChild`)
- `DropdownMenu` is based on `@base-ui/react/menu`, not radix. `DropdownMenuContent` accepts `side`/`align` directly (no wrapping Positioner needed)
- Read Next.js docs at `node_modules/next/dist/docs/` before writing any file-convention code (layouts, pages, route handlers)

---

### Task 1: Add shadcn UI Components + Update Session Types

**Files:**
- Scaffold via CLI: `src/components/ui/sidebar.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/tooltip.tsx`, `src/components/ui/separator.tsx`, `src/components/ui/skeleton.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/hooks/use-mobile.ts`
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: All shadcn sidebar/dropdown primitives available for import; `Session.user.name` (string) available in session; `JWT.name` (string) available in token

- [ ] **Step 1: Install shadcn sidebar component**

Run:
```bash
npx shadcn@latest add sidebar
```

Expected: 6 files created — `sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, `skeleton.tsx` under `src/components/ui/`, and `use-mobile.ts` under `src/hooks/`. Existing `button.tsx` and `input.tsx` skipped.

- [ ] **Step 2: Install shadcn dropdown-menu component**

Run:
```bash
npx shadcn@latest add dropdown-menu
```

Expected: 1 file created — `src/components/ui/dropdown-menu.tsx`.

- [ ] **Step 3: Verify all UI components exist**

Run:
```bash
ls src/components/ui/ src/hooks/
```

Expected files in `src/components/ui/`: `button.tsx`, `card.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `tooltip.tsx`. Expected in `src/hooks/`: `use-mobile.ts`.

- [ ] **Step 4: Add `name` to NextAuth type augmentation**

Modify `src/types/next-auth.d.ts` to add `name: string` to both `Session.user` and `JWT`:

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
      name: string;
      email: string;
      role: "EMPLOYEE" | "MANAGER" | "HR";
      departmentId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    name: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
    departmentId: string | null;
  }
}
```

- [ ] **Step 5: Update auth callbacks to explicitly persist `name`**

Modify `src/lib/auth.ts` — update the `jwt` callback to set `token.name` and the `session` callback to set `session.user.name`:

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

- [ ] **Step 6: Verify the project compiles**

Run:
```bash
npx next build 2>&1 | tail -20
```

Expected: No TypeScript errors from the modified files. Build may succeed or fail on unrelated issues, but there should be no type errors from `next-auth.d.ts` or `auth.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/sidebar.tsx src/components/ui/sheet.tsx src/components/ui/tooltip.tsx src/components/ui/separator.tsx src/components/ui/skeleton.tsx src/components/ui/dropdown-menu.tsx src/hooks/use-mobile.ts src/types/next-auth.d.ts src/lib/auth.ts
git commit -m "feat(layout): add shadcn sidebar/dropdown components and extend session with name"
```

---

### Task 2: Create AppSidebar Component

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`

**Interfaces:**
- Consumes: `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarHeader`, `SidebarFooter`, `SidebarSeparator` from `@/components/ui/sidebar`; `Link` from `next/link`; `usePathname` from `next/navigation`; lucide icons
- Produces: `<AppSidebar user={user} />` component — accepts `user: { name: string; email: string; role: "EMPLOYEE" | "MANAGER" | "HR" }`

- [ ] **Step 1: Create the app-sidebar component**

Create `src/components/layout/app-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Calendar,
  BarChart3,
  ClipboardCheck,
  FileText,
  Building2,
  Users,
  CalendarRange,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const commonItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Leaves", href: "/leaves", icon: CalendarDays },
];

const managerItems: NavItem[] = [
  { label: "Approvals", href: "/manager/approvals", icon: CheckSquare },
  { label: "Team Calendar", href: "/manager/calendar", icon: Calendar },
  { label: "Reports", href: "/manager/reports", icon: BarChart3 },
];

const hrApprovalItems: NavItem[] = [
  { label: "HR Approvals", href: "/hr/approvals", icon: ClipboardCheck },
];

const hrAdminItems: NavItem[] = [
  { label: "Leave Types", href: "/hr/leave-types", icon: FileText },
  { label: "Departments", href: "/hr/departments", icon: Building2 },
  { label: "Users", href: "/hr/users", icon: Users },
  { label: "Calendar", href: "/hr/calendar", icon: CalendarRange },
  { label: "Reports", href: "/hr/reports", icon: BarChart3 },
];

type AppSidebarProps = {
  user: {
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
  };
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  const isManager = user.role === "MANAGER";
  const isHR = user.role === "HR";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarDays className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">LeaveMS</span>
                <span className="truncate text-xs text-muted-foreground">
                  Leave Management
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {commonItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  tooltip={item.label}
                  isActive={pathname === item.href}
                  render={<Link href={item.href} />}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {isManager && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {managerItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        {isHR && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {hrApprovalItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {hrAdminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "app-sidebar" || echo "No errors in app-sidebar"
```

Expected: No TypeScript errors mentioning `app-sidebar`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat(layout): add AppSidebar with role-based navigation"
```

---

### Task 3: Create Header Component

**Files:**
- Create: `src/components/layout/header.tsx`

**Interfaces:**
- Consumes: `SidebarTrigger` from `@/components/ui/sidebar`; `Separator` from `@/components/ui/separator`; `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator` from `@/components/ui/dropdown-menu`; `Button` from `@/components/ui/button`; `signOut` from `next-auth/react`; `LogOut` from `lucide-react`
- Produces: `<Header user={user} />` component — accepts `user: { name: string; email: string; role: "EMPLOYEE" | "MANAGER" | "HR" }`

- [ ] **Step 1: Create the header component**

Create `src/components/layout/header.tsx`:

```tsx
"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const roleBadgeClasses: Record<string, string> = {
  HR: "bg-blue-100 text-blue-700",
  MANAGER: "bg-amber-100 text-amber-700",
  EMPLOYEE: "bg-gray-100 text-gray-700",
};

type HeaderProps = {
  user: {
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
  };
};

export function Header({ user }: HeaderProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-sm font-medium">Dashboard</h1>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="gap-2" />
            }
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {initials}
            </div>
            <span className="hidden sm:inline">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
            <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
            <DropdownMenuLabel>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClasses[user.role]}`}
              >
                {user.role}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => signOut({ redirectTo: "/login" })}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "header" || echo "No errors in header"
```

Expected: No TypeScript errors mentioning `header.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat(layout): add Header with user dropdown menu and logout"
```

---

### Task 4: Create Dashboard Layout + Update Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`; `SidebarProvider`, `SidebarInset` from `@/components/ui/sidebar`; `TooltipProvider` from `@/components/ui/tooltip`; `AppSidebar` from `@/components/layout/app-sidebar`; `Header` from `@/components/layout/header`; `redirect` from `next/navigation`
- Produces: Dashboard layout wrapping all `(dashboard)` routes; updated `/dashboard` page with welcome message and role badge

- [ ] **Step 1: Create the dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <Header user={user} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Update the dashboard page**

Replace the contents of `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const roleBadgeClasses: Record<string, string> = {
  HR: "bg-blue-100 text-blue-700",
  MANAGER: "bg-amber-100 text-amber-700",
  EMPLOYEE: "bg-gray-100 text-gray-700",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const firstName = session.user.name.split(" ")[0];

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Welcome back, {firstName}
      </h1>
      <p className="mt-2 text-muted-foreground">
        You are logged in as{" "}
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClasses[session.user.role]}`}
        >
          {session.user.role}
        </span>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify the project compiles**

Run:
```bash
npx next build 2>&1 | tail -30
```

Expected: Build succeeds with no TypeScript errors. The dashboard page and layout should compile.

- [ ] **Step 4: Start dev server and test manually**

Run:
```bash
npx next dev
```

Open `http://localhost:3000/login` in a browser. Log in with the seeded HR user:
- Email: `admin@company.com`
- Password: `admin123`

Verify:
1. Sidebar appears on the left with "LeaveMS" header, all nav sections (Dashboard, My Leaves, HR Approvals, Leave Types, Departments, Users, Calendar, Reports)
2. Dashboard link is highlighted (active state)
3. Sidebar footer shows user name and email
4. Header shows sidebar toggle, "Dashboard" title, and user avatar with name
5. Click user menu → dropdown shows name, "HR" badge in blue, and "Log out"
6. Click sidebar collapse toggle → sidebar collapses to icons only, tooltips appear on hover
7. Click toggle again → sidebar expands back
8. Resize browser to < 768px → sidebar disappears, toggle becomes hamburger
9. Click hamburger → sidebar slides in as sheet overlay
10. Click "Log out" → redirected to `/login`, session cleared

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/layout.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(layout): add dashboard layout with sidebar, header, and updated welcome page"
```

---

## Verification Checklist

After all tasks are complete, verify these scenarios one final time:

1. Login as HR (`admin@company.com` / `admin123`) → sidebar shows all sections (personal + HR approvals + HR admin)
2. Register a new Employee account, login → sidebar shows only Dashboard and My Leaves (2 items)
3. Toggle sidebar collapse → labels hide, icons remain, content area expands, tooltips appear on hover
4. Toggle sidebar expand → labels reappear
5. Resize to mobile width → sidebar disappears, hamburger appears in header
6. Click hamburger on mobile → sidebar slides in as overlay sheet
7. Click user dropdown → shows name, colored role badge, and logout
8. Click "Log out" → redirected to `/login`, session cleared
9. Dashboard shows "Welcome back, {firstName}" with colored role badge
10. Active link highlighting → Dashboard nav item is visually highlighted
11. Click a nav link without a page (e.g., My Leaves at `/leaves`) → 404 expected, but sidebar and header layout still renders correctly
