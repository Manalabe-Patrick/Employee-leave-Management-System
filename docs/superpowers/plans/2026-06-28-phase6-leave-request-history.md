# Phase 6: Leave Request & History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees submit leave requests with balance validation, view their leave history with filters, and cancel pending requests.

**Architecture:** Server Actions pattern (consistent with Phases 4-5). Service layer handles business logic in `leave.service.ts`. Server Actions in `leaves/actions.ts` handle auth + validation. Server Components for pages, Client Components for interactive forms/tables.

**Tech Stack:** Next.js (App Router, Server Components, Server Actions), Prisma, TypeScript, shadcn/ui, Tailwind CSS

## Global Constraints

- All shadcn components needed are already installed: `Select`, `Input`, `Textarea`, `Button`, `Card`, `Label`, `Table`, `Badge`, `Dialog`
- Prisma client is at `@/generated/prisma/client`, accessed via `db` from `@/lib/db`
- Auth via `auth()` from `@/lib/auth` — session shape: `{ user: { userId, name, email, role, departmentId } }`
- Types re-exported from `@/types/index` — use `LeaveRequestStatus` enum from there
- Server Actions return `{ success: boolean; error?: string }`
- Revalidate paths after mutations with `revalidatePath()`
- Read Next.js docs in `node_modules/next/dist/docs/` before writing any Next.js code

---

### Task 1: Service Layer — Business Day Calculator and Leave Balance Query

**Files:**
- Modify: `src/services/leave.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces:
  - `calculateBusinessDays(startDate: Date, endDate: Date): number`
  - `getUserLeaveBalances(userId: string): Promise<Array<{ id: string; leaveTypeId: string; year: number; totalAllowance: number; usedDays: number; pendingDays: number; leaveType: { id: string; name: string; isActive: boolean } }>>`

- [ ] **Step 1: Add `calculateBusinessDays` to `src/services/leave.service.ts`**

Append to the bottom of the existing file:

```ts
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  if (endDate < startDate) return 0;

  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
```

- [ ] **Step 2: Verify `calculateBusinessDays` logic manually**

Open a Node REPL or write a quick check — a Monday (day 1) to Friday (day 5) in the same week should return 5. A Saturday to Sunday range should return 0. A single Monday should return 1.

Run: `npx tsx -e "const { calculateBusinessDays } = require('./src/services/leave.service'); console.log(calculateBusinessDays(new Date('2026-07-06'), new Date('2026-07-10'))); console.log(calculateBusinessDays(new Date('2026-07-11'), new Date('2026-07-12'))); console.log(calculateBusinessDays(new Date('2026-07-06'), new Date('2026-07-06')));"`

Expected output:
```
5
0
1
```

(2026-07-06 is a Monday, 2026-07-10 is a Friday, 2026-07-11 is a Saturday, 2026-07-12 is a Sunday.)

- [ ] **Step 3: Add `getUserLeaveBalances` to `src/services/leave.service.ts`**

Append below `calculateBusinessDays`:

```ts
export async function getUserLeaveBalances(userId: string) {
  const currentYear = new Date().getFullYear();
  return db.leaveBalance.findMany({
    where: {
      userId,
      year: currentYear,
      leaveType: { isActive: true },
    },
    include: {
      leaveType: {
        select: { id: true, name: true, isActive: true },
      },
    },
    orderBy: { leaveType: { name: "asc" } },
  });
}
```

- [ ] **Step 4: Verify the file compiles**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to `leave.service.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/services/leave.service.ts
git commit -m "feat(leaves): add business day calculator and leave balance query"
```

---

### Task 2: Service Layer — Submit Leave Request

**Files:**
- Modify: `src/services/leave.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`, `calculateBusinessDays` from same file
- Produces:
  - `submitLeaveRequest(userId: string, data: { leaveTypeId: string; startDate: Date; endDate: Date; reason: string }): Promise<LeaveRequest>` — throws `Error` with descriptive message on validation failure

- [ ] **Step 1: Add `submitLeaveRequest` to `src/services/leave.service.ts`**

Append below `getUserLeaveBalances`:

```ts
export async function submitLeaveRequest(
  userId: string,
  data: {
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  }
) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.departmentId) {
      throw new Error("You must be assigned to a department before submitting leave");
    }

    const leaveType = await tx.leaveType.findUniqueOrThrow({
      where: { id: data.leaveTypeId },
    });
    if (!leaveType.isActive) {
      throw new Error("This leave type is no longer active");
    }

    const totalDays = calculateBusinessDays(data.startDate, data.endDate);
    if (totalDays === 0) {
      throw new Error("Selected date range contains no business days");
    }

    const currentYear = new Date().getFullYear();
    const balance = await tx.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId: data.leaveTypeId,
          year: currentYear,
        },
      },
    });
    if (!balance) {
      throw new Error("No leave balance found for this leave type");
    }

    const remaining = balance.totalAllowance - balance.usedDays - balance.pendingDays;
    if (totalDays > remaining) {
      throw new Error(
        `Insufficient balance. You have ${remaining} day${remaining === 1 ? "" : "s"} remaining`
      );
    }

    const overlap = await tx.leaveRequest.findFirst({
      where: {
        userId,
        status: { not: "CANCELLED" },
        startDate: { lte: data.endDate },
        endDate: { gte: data.startDate },
      },
    });
    if (overlap) {
      throw new Error("You already have a leave request that overlaps with these dates");
    }

    const request = await tx.leaveRequest.create({
      data: {
        userId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
        reason: data.reason,
        status: "PENDING_MANAGER",
      },
    });

    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId: data.leaveTypeId,
          year: currentYear,
        },
      },
      data: {
        pendingDays: { increment: totalDays },
      },
    });

    return request;
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to `leave.service.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/services/leave.service.ts
git commit -m "feat(leaves): add submit leave request with balance and overlap validation"
```

---

### Task 3: Service Layer — Cancel Leave Request and Query Leave Requests

**Files:**
- Modify: `src/services/leave.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces:
  - `cancelLeaveRequest(userId: string, requestId: string): Promise<LeaveRequest>` — throws `Error` on validation failure
  - `getUserLeaveRequests(userId: string, filters?: { status?: string; leaveTypeId?: string }): Promise<Array<LeaveRequest & { leaveType: { id: string; name: string } }>>`

- [ ] **Step 1: Add `cancelLeaveRequest` to `src/services/leave.service.ts`**

Append below `submitLeaveRequest`:

```ts
export async function cancelLeaveRequest(userId: string, requestId: string) {
  return db.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    if (request.userId !== userId) {
      throw new Error("You can only cancel your own leave requests");
    }

    if (request.status !== "PENDING_MANAGER" && request.status !== "PENDING_HR") {
      throw new Error("Only pending requests can be cancelled");
    }

    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });

    const currentYear = new Date().getFullYear();
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId: request.leaveTypeId,
          year: currentYear,
        },
      },
      data: {
        pendingDays: { decrement: request.totalDays },
      },
    });

    return updated;
  });
}
```

- [ ] **Step 2: Add `getUserLeaveRequests` to `src/services/leave.service.ts`**

Append below `cancelLeaveRequest`:

```ts
export async function getUserLeaveRequests(
  userId: string,
  filters?: { status?: string; leaveTypeId?: string }
) {
  const where: Record<string, unknown> = { userId };
  if (filters?.status) where.status = filters.status;
  if (filters?.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;

  return db.leaveRequest.findMany({
    where,
    include: {
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to `leave.service.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/services/leave.service.ts
git commit -m "feat(leaves): add cancel leave request and leave history query"
```

---

### Task 4: Server Actions — Submit and Cancel Leave

**Files:**
- Create: `src/app/(dashboard)/leaves/actions.ts`

**Interfaces:**
- Consumes:
  - `auth()` from `@/lib/auth`
  - `submitLeaveRequest(userId, data)` from `@/services/leave.service`
  - `cancelLeaveRequest(userId, requestId)` from `@/services/leave.service`
  - `revalidatePath()` from `next/cache`
- Produces:
  - `submitLeaveRequestAction(formData: FormData): Promise<{ success: boolean; error?: string }>`
  - `cancelLeaveRequestAction(requestId: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Create `src/app/(dashboard)/leaves/actions.ts`**

```ts
"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  submitLeaveRequest,
  cancelLeaveRequest,
} from "@/services/leave.service";

async function requireAuth() {
  const session = await auth();
  if (!session) return null;
  return session;
}

export async function submitLeaveRequestAction(formData: FormData) {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };

  const leaveTypeId = formData.get("leaveTypeId") as string | null;
  const startDateRaw = formData.get("startDate") as string | null;
  const endDateRaw = formData.get("endDate") as string | null;
  const reason = formData.get("reason") as string | null;

  if (!leaveTypeId) return { success: false, error: "Leave type is required" };
  if (!startDateRaw) return { success: false, error: "Start date is required" };
  if (!endDateRaw) return { success: false, error: "End date is required" };
  if (!reason || !reason.trim()) return { success: false, error: "Reason is required" };

  const startDate = new Date(startDateRaw);
  const endDate = new Date(endDateRaw);

  if (isNaN(startDate.getTime())) return { success: false, error: "Invalid start date" };
  if (isNaN(endDate.getTime())) return { success: false, error: "Invalid end date" };
  if (endDate < startDate) return { success: false, error: "End date must be on or after start date" };

  try {
    await submitLeaveRequest(session.user.userId, {
      leaveTypeId,
      startDate,
      endDate,
      reason: reason.trim(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit leave request";
    return { success: false, error: message };
  }

  revalidatePath("/leaves");
  return { success: true };
}

export async function cancelLeaveRequestAction(requestId: string) {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await cancelLeaveRequest(session.user.userId, requestId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel leave request";
    return { success: false, error: message };
  }

  revalidatePath("/leaves");
  return { success: true };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to `leaves/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/leaves/actions.ts
git commit -m "feat(leaves): add server actions for submit and cancel leave"
```

---

### Task 5: Leave Request Form Page and Component

**Files:**
- Create: `src/app/(dashboard)/leaves/new/page.tsx`
- Create: `src/components/leaves/leave-request-form.tsx`

**Interfaces:**
- Consumes:
  - `auth()` from `@/lib/auth`
  - `getUserLeaveBalances(userId)` from `@/services/leave.service`
  - `submitLeaveRequestAction(formData)` from `@/app/(dashboard)/leaves/actions`
  - `calculateBusinessDays(startDate, endDate)` from `@/services/leave.service` (imported in client component for live preview — it's a pure function with no db dependency)
- Produces: `/leaves/new` page with interactive leave request form

- [ ] **Step 1: Create `src/components/leaves/leave-request-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitLeaveRequestAction } from "@/app/(dashboard)/leaves/actions";
import { calculateBusinessDays } from "@/services/leave.service";

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  leaveType: { id: string; name: string };
}

interface LeaveRequestFormProps {
  balances: LeaveBalance[];
}

export function LeaveRequestForm({ balances }: LeaveRequestFormProps) {
  const router = useRouter();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);
  const remaining = selectedBalance
    ? selectedBalance.totalAllowance - selectedBalance.usedDays - selectedBalance.pendingDays
    : null;

  let businessDays = 0;
  if (startDate && endDate) {
    businessDays = calculateBusinessDays(new Date(startDate), new Date(endDate));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!leaveTypeId) { setError("Please select a leave type"); return; }
    if (!startDate) { setError("Please select a start date"); return; }
    if (!endDate) { setError("Please select an end date"); return; }
    if (new Date(endDate) < new Date(startDate)) { setError("End date must be on or after start date"); return; }
    if (businessDays === 0) { setError("Selected date range contains no business days"); return; }
    if (!reason.trim()) { setError("Please provide a reason"); return; }
    if (remaining !== null && businessDays > remaining) {
      setError(`Insufficient balance. You have ${remaining} day${remaining === 1 ? "" : "s"} remaining`);
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("leaveTypeId", leaveTypeId);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("reason", reason.trim());

    const result = await submitLeaveRequestAction(formData);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }

    router.push("/leaves");
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Request Leave</CardTitle>
        <CardDescription>
          Submit a new leave request for approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="leaveType">Leave Type</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger id="leaveType">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((b) => {
                    const rem = b.totalAllowance - b.usedDays - b.pendingDays;
                    return (
                      <SelectItem key={b.leaveTypeId} value={b.leaveTypeId}>
                        {b.leaveType.name} ({rem} remaining)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
              <p className="text-sm text-muted-foreground">
                {businessDays} business day{businessDays === 1 ? "" : "s"}
                {remaining !== null && (
                  <> &middot; {remaining} day{remaining === 1 ? "" : "s"} remaining</>
                )}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe the reason for your leave"
                rows={3}
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/leaves")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/leaves/new/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserLeaveBalances } from "@/services/leave.service";
import { LeaveRequestForm } from "@/components/leaves/leave-request-form";

export default async function NewLeavePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const balances = await getUserLeaveBalances(session.user.userId);

  return <LeaveRequestForm balances={balances} />;
}
```

- [ ] **Step 3: Verify the files compile**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to the new files.

- [ ] **Step 4: Commit**

```bash
git add src/components/leaves/leave-request-form.tsx src/app/(dashboard)/leaves/new/page.tsx
git commit -m "feat(leaves): add leave request form page and component"
```

---

### Task 6: Leave History Page and Component

**Files:**
- Create: `src/app/(dashboard)/leaves/page.tsx`
- Create: `src/components/leaves/leave-history-table.tsx`

**Interfaces:**
- Consumes:
  - `auth()` from `@/lib/auth`
  - `getUserLeaveRequests(userId)` from `@/services/leave.service`
  - `getAllLeaveTypes()` from `@/services/leave.service`
  - `cancelLeaveRequestAction(requestId)` from `@/app/(dashboard)/leaves/actions`
- Produces: `/leaves` page with filterable leave history table and cancel action

- [ ] **Step 1: Create `src/components/leaves/leave-history-table.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import { cancelLeaveRequestAction } from "@/app/(dashboard)/leaves/actions";

interface LeaveRequest {
  id: string;
  leaveTypeId: string;
  startDate: string | Date;
  endDate: string | Date;
  totalDays: number;
  reason: string;
  status: string;
  createdAt: string | Date;
  leaveType: { id: string; name: string };
}

interface LeaveTypeOption {
  id: string;
  name: string;
}

interface LeaveHistoryTableProps {
  requests: LeaveRequest[];
  leaveTypes: LeaveTypeOption[];
}

const STATUS_ALL = "__all__";

const statusBadgeStyles: Record<string, { className: string; label: string }> = {
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

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LeaveHistoryTable({
  requests,
  leaveTypes,
}: LeaveHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [typeFilter, setTypeFilter] = useState(STATUS_ALL);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = requests.filter((r) => {
    if (statusFilter !== STATUS_ALL && r.status !== statusFilter) return false;
    if (typeFilter !== STATUS_ALL && r.leaveTypeId !== typeFilter) return false;
    return true;
  });

  function openCancelDialog(id: string) {
    setCancellingId(id);
    setCancelDialogOpen(true);
    setError("");
  }

  async function handleCancel() {
    if (!cancellingId) return;
    setCancelLoading(true);
    setError("");

    const result = await cancelLeaveRequestAction(cancellingId);
    setCancelLoading(false);

    if (!result.success) {
      setError(result.error || "Failed to cancel request");
      return;
    }

    setCancelDialogOpen(false);
    setCancellingId(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">My Leaves</h1>
        <Button render={<Link href="/leaves/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          Request Leave
        </Button>
      </div>

      <div className="flex gap-4 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>All Statuses</SelectItem>
            <SelectItem value="PENDING_MANAGER">Pending Manager</SelectItem>
            <SelectItem value="PENDING_HR">Pending HR</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>All Types</SelectItem>
            {leaveTypes.map((lt) => (
              <SelectItem key={lt.id} value={lt.id}>
                {lt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leave Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-center">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No leave requests found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const badge = statusBadgeStyles[r.status] ?? {
                  className: "",
                  label: r.status,
                };
                const canCancel =
                  r.status === "PENDING_MANAGER" || r.status === "PENDING_HR";

                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.leaveType.name}
                    </TableCell>
                    <TableCell>{formatDate(r.startDate)}</TableCell>
                    <TableCell>{formatDate(r.endDate)}</TableCell>
                    <TableCell className="text-center">{r.totalDays}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCancelDialog(r.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Leave Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this leave request? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading ? "Cancelling..." : "Cancel Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/leaves/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserLeaveRequests, getAllLeaveTypes } from "@/services/leave.service";
import { LeaveHistoryTable } from "@/components/leaves/leave-history-table";

export default async function LeavesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [requests, leaveTypes] = await Promise.all([
    getUserLeaveRequests(session.user.userId),
    getAllLeaveTypes(),
  ]);

  const activeTypes = leaveTypes
    .filter((lt) => lt.isActive)
    .map((lt) => ({ id: lt.id, name: lt.name }));

  return <LeaveHistoryTable requests={requests} leaveTypes={activeTypes} />;
}
```

- [ ] **Step 3: Verify the files compile**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to the new files.

- [ ] **Step 4: Commit**

```bash
git add src/components/leaves/leave-history-table.tsx src/app/(dashboard)/leaves/page.tsx
git commit -m "feat(leaves): add leave history page with filters and cancel action"
```

---

### Task 7: Manual End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Open `http://localhost:3000` in a browser.

- [ ] **Step 2: Test leave request form**

1. Log in as an employee who is assigned to a department and has leave balances
2. Click "My Leaves" in the sidebar → should show the leave history page (empty if no requests yet)
3. Click "Request Leave" button → should navigate to `/leaves/new`
4. Verify the leave type dropdown shows active types with remaining days
5. Select a leave type, pick start/end dates within the same week (Mon–Fri) → verify business day count shows correctly
6. Pick a weekend-only range (Sat–Sun) → verify it shows 0 business days
7. Fill in reason, submit → should redirect to `/leaves` with the new request showing `Pending Manager` status

- [ ] **Step 3: Test validation**

1. Try submitting without selecting a leave type → error shown
2. Try submitting with end date before start date → error shown
3. Try submitting with more days than remaining balance → error shown
4. Submit two requests with overlapping dates → second one should show overlap error

- [ ] **Step 4: Test cancel**

1. On the leave history page, find a request with `Pending Manager` or `Pending HR` status
2. Click the X button → confirmation dialog appears
3. Confirm → request status changes to `Cancelled`
4. Verify the cancel button does NOT appear on `Approved`, `Declined`, or `Cancelled` requests

- [ ] **Step 5: Test filters**

1. On the leave history page, use the status filter dropdown → table shows only matching requests
2. Use the leave type filter → table filters accordingly
3. Combine both filters → should AND them together
4. When no results match → empty state message shown

- [ ] **Step 6: Commit any fixes found during testing**

If any issues are found during manual testing, fix them and commit:

```bash
git add -A
git commit -m "fix(leaves): address issues found during manual testing"
```
