# Phase 8: Employee Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder dashboard with a rich, role-aware page showing leave balance cards, recent leave requests, and actionable alert banners for managers/HR.

**Architecture:** Single Server Component page fetches all data in parallel via `Promise.all`, then passes props to three presentational components. No client-side state or interactivity needed. Service functions are added to the existing `leave.service.ts`.

**Tech Stack:** Next.js (App Router, Server Components), Prisma, TypeScript, Tailwind CSS, shadcn/ui (Card, Badge, Button, Table)

## Global Constraints

- Follow existing codebase patterns: Server Components with direct service calls, no API routes for reads
- Use existing shadcn/ui components — do not install new packages
- All components are Server Components (no `"use client"` directive)
- Session shape: `session.user.userId`, `session.user.name`, `session.user.role` (from `@/lib/auth`)
- Imports use `@/` path alias throughout
- Check `node_modules/next/dist/docs/` before using any Next.js API you're unsure about

---

### Task 1: Extract statusBadgeStyles to shared constants and add service functions

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/components/leaves/leave-history-table.tsx:57-78`
- Modify: `src/services/leave.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db` (Prisma client singleton)
- Produces:
  - `statusBadgeStyles` exported from `src/lib/constants.ts` — type `Record<string, { className: string; label: string }>`
  - `getRecentLeaveRequests(userId: string, limit: number)` — returns `Promise<Array<{ id, startDate, endDate, totalDays, status, createdAt, leaveType: { id, name } }>>` 
  - `getPendingManagerCount(managerId: string)` — returns `Promise<number>`
  - `getPendingHRCount()` — returns `Promise<number>`

- [ ] **Step 1: Add `statusBadgeStyles` to `src/lib/constants.ts`**

Add this export to the end of the existing file (after `roleBadgeClasses`):

```typescript
export const statusBadgeStyles: Record<string, { className: string; label: string }> = {
  PENDING_MANAGER: {
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    label: "Pending Manager",
  },
  PENDING_HR: {
    className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    label: "Pending HR",
  },
  APPROVED: {
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    label: "Approved",
  },
  DECLINED: {
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    label: "Declined",
  },
  CANCELLED: {
    className: "bg-gray-100 text-gray-500 hover:bg-gray-100",
    label: "Cancelled",
  },
};
```

- [ ] **Step 2: Update `leave-history-table.tsx` to import from constants**

In `src/components/leaves/leave-history-table.tsx`:

1. Add import: `import { statusBadgeStyles } from "@/lib/constants";`
2. Delete the local `statusBadgeStyles` constant (lines 57-78 — the entire `const statusBadgeStyles: Record<...> = { ... };` block)

- [ ] **Step 3: Add three service functions to `src/services/leave.service.ts`**

Append these three functions to the end of the file:

```typescript
export async function getRecentLeaveRequests(userId: string, limit: number) {
  return db.leaveRequest.findMany({
    where: { userId },
    include: {
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getPendingManagerCount(managerId: string) {
  const department = await db.department.findFirst({
    where: { managerId },
    select: { id: true },
  });

  if (!department) return 0;

  return db.leaveRequest.count({
    where: {
      status: "PENDING_MANAGER",
      user: { departmentId: department.id },
    },
  });
}

export async function getPendingHRCount() {
  return db.leaveRequest.count({
    where: { status: "PENDING_HR" },
  });
}
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx next build --no-lint 2>&1 | tail -5` (or check for TypeScript errors with `npx tsc --noEmit`)

Expected: No compilation errors. The `leave-history-table.tsx` still works because the imported `statusBadgeStyles` has the exact same shape and values.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/components/leaves/leave-history-table.tsx src/services/leave.service.ts
git commit -m "feat(dashboard): extract statusBadgeStyles to constants and add dashboard service functions"
```

---

### Task 2: Create DashboardAlerts component

**Files:**
- Create: `src/components/layout/dashboard-alerts.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (self-contained component)
- Produces: `DashboardAlerts` component with props `{ role: "EMPLOYEE" | "MANAGER" | "HR"; pendingManagerCount?: number; pendingHRCount?: number }`

- [ ] **Step 1: Create `src/components/layout/dashboard-alerts.tsx`**

```tsx
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type DashboardAlertsProps = {
  role: "EMPLOYEE" | "MANAGER" | "HR";
  pendingManagerCount?: number;
  pendingHRCount?: number;
};

export function DashboardAlerts({
  role,
  pendingManagerCount,
  pendingHRCount,
}: DashboardAlertsProps) {
  if (role === "EMPLOYEE") return null;

  const alerts: { href: string; message: string }[] = [];

  if (role === "MANAGER" && pendingManagerCount && pendingManagerCount > 0) {
    alerts.push({
      href: "/manager/approvals",
      message: `You have ${pendingManagerCount} request${pendingManagerCount === 1 ? "" : "s"} to review`,
    });
  }

  if (role === "HR" && pendingHRCount && pendingHRCount > 0) {
    alerts.push({
      href: "/hr/approvals",
      message: `You have ${pendingHRCount} request${pendingHRCount === 1 ? "" : "s"} awaiting final approval`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Link
          key={alert.href}
          href={alert.href}
          className="flex items-center gap-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {alert.message}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/dashboard-alerts.tsx
git commit -m "feat(dashboard): add DashboardAlerts component"
```

---

### Task 3: Create LeaveBalanceCards component

**Files:**
- Create: `src/components/leaves/leave-balance-cards.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (self-contained component)
- Produces: `LeaveBalanceCards` component with props `{ balances: Array<{ totalAllowance: number; usedDays: number; pendingDays: number; leaveType: { id: string; name: string } }> }`

- [ ] **Step 1: Create `src/components/leaves/leave-balance-cards.tsx`**

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Balance = {
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  leaveType: { id: string; name: string };
};

type LeaveBalanceCardsProps = {
  balances: Balance[];
};

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  if (balances.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No leave balances — contact HR to be assigned to a department
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => {
        const remaining =
          balance.totalAllowance - balance.usedDays - balance.pendingDays;

        return (
          <Card key={balance.leaveType.id}>
            <CardHeader>
              <CardTitle>{balance.leaveType.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {remaining}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {balance.totalAllowance} days remaining
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {balance.usedDays} used
                {balance.pendingDays > 0 && (
                  <> · {balance.pendingDays} pending</>
                )}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/leaves/leave-balance-cards.tsx
git commit -m "feat(dashboard): add LeaveBalanceCards component"
```

---

### Task 4: Create RecentRequests component

**Files:**
- Create: `src/components/leaves/recent-requests.tsx`

**Interfaces:**
- Consumes: `statusBadgeStyles` from `src/lib/constants.ts` (produced in Task 1)
- Produces: `RecentRequests` component with props `{ requests: Array<{ id: string; startDate: Date | string; endDate: Date | string; totalDays: number; status: string; createdAt: Date | string; leaveType: { id: string; name: string } }> }`

- [ ] **Step 1: Create `src/components/leaves/recent-requests.tsx`**

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusBadgeStyles } from "@/lib/constants";

type LeaveRequest = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  totalDays: number;
  status: string;
  createdAt: Date | string;
  leaveType: { id: string; name: string };
};

type RecentRequestsProps = {
  requests: LeaveRequest[];
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecentRequests({ requests }: RecentRequestsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Requests</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/leaves" />}
          >
            View all
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/leaves/new" />}>
            <Plus className="mr-1 h-4 w-4" />
            Request Leave
          </Button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No leave requests yet
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const badge = statusBadgeStyles[r.status] ?? {
                  className: "",
                  label: r.status,
                };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.leaveType.name}
                    </TableCell>
                    <TableCell>
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </TableCell>
                    <TableCell className="text-center">{r.totalDays}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/leaves/recent-requests.tsx
git commit -m "feat(dashboard): add RecentRequests component"
```

---

### Task 5: Replace dashboard page with rich dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (full replacement)

**Interfaces:**
- Consumes:
  - `auth()` from `@/lib/auth` — returns `session` with `session.user.userId`, `session.user.name`, `session.user.role`
  - `getUserLeaveBalances(userId: string)` from `@/services/leave.service` (existing)
  - `getRecentLeaveRequests(userId: string, limit: number)` from `@/services/leave.service` (Task 1)
  - `getPendingManagerCount(managerId: string)` from `@/services/leave.service` (Task 1)
  - `getPendingHRCount()` from `@/services/leave.service` (Task 1)
  - `DashboardAlerts` component (Task 2)
  - `LeaveBalanceCards` component (Task 3)
  - `RecentRequests` component (Task 4)
  - `roleBadgeClasses` from `@/lib/constants` (existing)
- Produces: Complete dashboard page (terminal task — nothing consumes this)

- [ ] **Step 1: Replace `src/app/(dashboard)/dashboard/page.tsx` with the full dashboard**

Replace the entire file contents with:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { roleBadgeClasses } from "@/lib/constants";
import {
  getUserLeaveBalances,
  getRecentLeaveRequests,
  getPendingManagerCount,
  getPendingHRCount,
} from "@/services/leave.service";
import { DashboardAlerts } from "@/components/layout/dashboard-alerts";
import { LeaveBalanceCards } from "@/components/leaves/leave-balance-cards";
import { RecentRequests } from "@/components/leaves/recent-requests";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { userId, name, role } = session.user;
  const firstName = name.split(" ")[0];

  const [balances, recentRequests, pendingManagerCount, pendingHRCount] =
    await Promise.all([
      getUserLeaveBalances(userId),
      getRecentLeaveRequests(userId, 5),
      role === "MANAGER" ? getPendingManagerCount(userId) : Promise.resolve(0),
      role === "HR" ? getPendingHRCount() : Promise.resolve(0),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">
          You are logged in as{" "}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClasses[role]}`}
          >
            {role}
          </span>
        </p>
      </div>

      <DashboardAlerts
        role={role}
        pendingManagerCount={pendingManagerCount}
        pendingHRCount={pendingHRCount}
      />

      <div>
        <h2 className="text-lg font-semibold mb-4">Leave Balances</h2>
        <LeaveBalanceCards balances={balances} />
      </div>

      <RecentRequests requests={recentRequests} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Manual test**

Run: `npx next dev`

Test these scenarios in the browser:

1. **Login as employee** → Dashboard shows welcome message, leave balance cards (or "no balances" if unassigned), recent requests (or "no leave requests yet" if none). No alert banners.
2. **Login as manager** → Dashboard shows alert banner with pending count linking to `/manager/approvals` (if any pending requests exist). Balance cards and recent requests display correctly.
3. **Login as HR** → Dashboard shows alert banner with pending HR count linking to `/hr/approvals` (if any pending requests exist). Balance cards and recent requests display correctly.
4. **Check the "Request Leave" button** → Navigates to `/leaves/new`.
5. **Check the "View all" link** → Navigates to `/leaves`.
6. **Check alert banner links** → Navigate to the correct approvals page.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): replace placeholder with rich role-aware dashboard"
```
