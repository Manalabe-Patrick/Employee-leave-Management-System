# Phase 7: Approval Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers approve/decline leave requests from their department, and HR give final approval/decline, with balance updates and self-leave edge cases handled.

**Architecture:** Server Actions pattern (consistent with Phases 4-6). A unified `reviewLeaveRequest` function in the service layer handles both manager and HR review stages. Separate server action files per role. A shared `ApprovalCard` client component is rendered by both the manager and HR approval pages (Server Components).

**Tech Stack:** Next.js (App Router, Server Components, Server Actions), Prisma, TypeScript, shadcn/ui, Tailwind CSS

## Global Constraints

- All shadcn components needed are already installed: `Card`, `CardHeader`, `CardContent`, `CardFooter`, `Button`, `Textarea`, `Badge`
- Prisma client is at `@/generated/prisma/client`, accessed via `db` from `@/lib/db`
- Auth via `auth()` from `@/lib/auth` — session shape: `{ user: { userId, name, email, role, departmentId } }`
- Types re-exported from `@/types/index` — use `LeaveRequestStatus` enum from there
- Server Actions return `{ success: boolean; error?: string }`
- Revalidate paths after mutations with `revalidatePath()`
- Read Next.js docs in `node_modules/next/dist/docs/` before writing any Next.js code

---

### Task 1: Service Layer — Review Leave Request, Query Functions, and Self-Leave Edge Cases

**Files:**
- Modify: `src/services/leave.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces:
  - `reviewLeaveRequest(reviewerId: string, requestId: string, action: "approve" | "decline", comment?: string): Promise<LeaveRequest>`
  - `getPendingManagerRequests(managerId: string): Promise<Array<LeaveRequest & { user: { firstName: string; lastName: string; email: string }; leaveType: { name: string } }>>`
  - `getPendingHRRequests(): Promise<Array<LeaveRequest & { user: { firstName: string; lastName: string; email: string; department: { name: string } | null }; leaveType: { name: string } }>>`
  - Modified `submitLeaveRequest` with manager self-leave edge case

- [ ] **Step 1: Add `reviewLeaveRequest` to `src/services/leave.service.ts`**

Append to the bottom of the existing file:

```ts
export async function reviewLeaveRequest(
  reviewerId: string,
  requestId: string,
  action: "approve" | "decline",
  comment?: string
) {
  return db.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { user: { select: { departmentId: true } } },
    });

    if (request.userId === reviewerId) {
      throw new Error("You cannot review your own leave request");
    }

    const reviewer = await tx.user.findUniqueOrThrow({
      where: { id: reviewerId },
    });

    if (request.status === "PENDING_MANAGER") {
      if (reviewer.role !== "MANAGER") {
        throw new Error("Only managers can review requests at this stage");
      }
      const department = await tx.department.findFirst({
        where: { managerId: reviewerId, id: request.user.departmentId ?? undefined },
      });
      if (!department) {
        throw new Error("You can only review requests from your own department");
      }
    } else if (request.status === "PENDING_HR") {
      if (reviewer.role !== "HR") {
        throw new Error("Only HR can review requests at this stage");
      }
    } else {
      throw new Error("This request has already been resolved");
    }

    const now = new Date();

    if (action === "approve") {
      if (request.status === "PENDING_MANAGER") {
        return tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            status: "PENDING_HR",
            reviewedByManagerId: reviewerId,
            managerComment: comment || null,
            managerReviewedAt: now,
          },
        });
      } else {
        const currentYear = new Date().getFullYear();
        await tx.leaveBalance.update({
          where: {
            userId_leaveTypeId_year: {
              userId: request.userId,
              leaveTypeId: request.leaveTypeId,
              year: currentYear,
            },
          },
          data: {
            pendingDays: { decrement: request.totalDays },
            usedDays: { increment: request.totalDays },
          },
        });

        return tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            reviewedByHRId: reviewerId,
            hrComment: comment || null,
            hrReviewedAt: now,
          },
        });
      }
    } else {
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId: request.userId,
            leaveTypeId: request.leaveTypeId,
            year: currentYear,
          },
        },
        data: {
          pendingDays: { decrement: request.totalDays },
        },
      });

      if (request.status === "PENDING_MANAGER") {
        return tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            status: "DECLINED",
            reviewedByManagerId: reviewerId,
            managerComment: comment || null,
            managerReviewedAt: now,
          },
        });
      } else {
        return tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            status: "DECLINED",
            reviewedByHRId: reviewerId,
            hrComment: comment || null,
            hrReviewedAt: now,
          },
        });
      }
    }
  });
}
```

- [ ] **Step 2: Add `getPendingManagerRequests` to `src/services/leave.service.ts`**

Append below `reviewLeaveRequest`:

```ts
export async function getPendingManagerRequests(managerId: string) {
  const department = await db.department.findFirst({
    where: { managerId },
    select: { id: true },
  });

  if (!department) return [];

  return db.leaveRequest.findMany({
    where: {
      status: "PENDING_MANAGER",
      user: { departmentId: department.id },
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      leaveType: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
```

- [ ] **Step 3: Add `getPendingHRRequests` to `src/services/leave.service.ts`**

Append below `getPendingManagerRequests`:

```ts
export async function getPendingHRRequests() {
  return db.leaveRequest.findMany({
    where: { status: "PENDING_HR" },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
```

- [ ] **Step 4: Modify `submitLeaveRequest` for manager self-leave edge case**

In the existing `submitLeaveRequest` function, after the `leaveRequest.create` call (the line `const request = await tx.leaveRequest.create({...})`), add the manager self-leave check. Replace the block that creates the request and updates the balance:

Find the existing code block inside `submitLeaveRequest` that starts with `const request = await tx.leaveRequest.create({` and ends with the `pendingDays` increment. Replace it with:

```ts
    const isManagerOfOwnDept = await tx.department.findFirst({
      where: { managerId: userId, id: user.departmentId ?? undefined },
    });

    const initialStatus = isManagerOfOwnDept ? "PENDING_HR" : "PENDING_MANAGER";

    const request = await tx.leaveRequest.create({
      data: {
        userId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
        reason: data.reason,
        status: initialStatus,
        reviewedByManagerId: isManagerOfOwnDept ? userId : undefined,
        managerReviewedAt: isManagerOfOwnDept ? new Date() : undefined,
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
```

- [ ] **Step 5: Verify the file compiles**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to `leave.service.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/services/leave.service.ts
git commit -m "feat(approvals): add review, query, and self-leave edge case to leave service"
```

---

### Task 2: Server Actions — Manager and HR Approve/Decline

**Files:**
- Create: `src/app/(dashboard)/manager/approvals/actions.ts`
- Create: `src/app/(dashboard)/hr/approvals/actions.ts`

**Interfaces:**
- Consumes:
  - `auth()` from `@/lib/auth`
  - `reviewLeaveRequest(reviewerId, requestId, action, comment?)` from `@/services/leave.service`
  - `revalidatePath()` from `next/cache`
- Produces:
  - `managerApproveAction(requestId: string, comment: string): Promise<{ success: boolean; error?: string }>`
  - `managerDeclineAction(requestId: string, comment: string): Promise<{ success: boolean; error?: string }>`
  - `hrApproveAction(requestId: string, comment: string): Promise<{ success: boolean; error?: string }>`
  - `hrDeclineAction(requestId: string, comment: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Create `src/app/(dashboard)/manager/approvals/actions.ts`**

```ts
"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { reviewLeaveRequest } from "@/services/leave.service";

async function requireManager() {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") return null;
  return session;
}

export async function managerApproveAction(requestId: string, comment: string) {
  const session = await requireManager();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "approve", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to approve request";
    return { success: false, error: message };
  }

  revalidatePath("/manager/approvals");
  return { success: true };
}

export async function managerDeclineAction(requestId: string, comment: string) {
  const session = await requireManager();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "decline", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to decline request";
    return { success: false, error: message };
  }

  revalidatePath("/manager/approvals");
  return { success: true };
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/hr/approvals/actions.ts`**

```ts
"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { reviewLeaveRequest } from "@/services/leave.service";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") return null;
  return session;
}

export async function hrApproveAction(requestId: string, comment: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "approve", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to approve request";
    return { success: false, error: message };
  }

  revalidatePath("/hr/approvals");
  return { success: true };
}

export async function hrDeclineAction(requestId: string, comment: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "decline", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to decline request";
    return { success: false, error: message };
  }

  revalidatePath("/hr/approvals");
  return { success: true };
}
```

- [ ] **Step 3: Verify the files compile**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to the new action files.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/manager/approvals/actions.ts src/app/(dashboard)/hr/approvals/actions.ts
git commit -m "feat(approvals): add manager and HR approve/decline server actions"
```

---

### Task 3: ApprovalCard Component

**Files:**
- Create: `src/components/leaves/approval-card.tsx`

**Interfaces:**
- Consumes: shadcn `Card`, `CardHeader`, `CardContent`, `CardFooter`, `Button`, `Textarea`, `Badge`
- Produces:
  - `ApprovalCard` component with props:
    - `request: { id: string; totalDays: number; reason: string; startDate: string | Date; endDate: string | Date; createdAt: string | Date; user: { firstName: string; lastName: string; email: string }; leaveType: { name: string }; departmentName?: string }`
    - `onApprove: (requestId: string, comment: string) => Promise<{ success: boolean; error?: string }>`
    - `onDecline: (requestId: string, comment: string) => Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Create `src/components/leaves/approval-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ApprovalRequest {
  id: string;
  totalDays: number;
  reason: string;
  startDate: string | Date;
  endDate: string | Date;
  createdAt: string | Date;
  user: { firstName: string; lastName: string; email: string };
  leaveType: { name: string };
  departmentName?: string;
}

interface ApprovalCardProps {
  request: ApprovalRequest;
  onApprove: (
    requestId: string,
    comment: string
  ) => Promise<{ success: boolean; error?: string }>;
  onDecline: (
    requestId: string,
    comment: string
  ) => Promise<{ success: boolean; error?: string }>;
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ApprovalCard({
  request,
  onApprove,
  onDecline,
}: ApprovalCardProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function handleAction(action: "approve" | "decline") {
    setLoading(action);
    setError("");

    const handler = action === "approve" ? onApprove : onDecline;
    const result = await handler(request.id, comment.trim());

    if (!result.success) {
      setError(result.error || `Failed to ${action} request`);
      setLoading(null);
      return;
    }

    setLoading(null);
  }

  const fullName = `${request.user.firstName} ${request.user.lastName}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {request.user.email}
              {request.departmentName && ` · ${request.departmentName}`}
            </p>
          </div>
          <Badge variant="secondary">
            {request.leaveType.name} · {request.totalDays} day
            {request.totalDays === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <span className="font-medium">
            {formatDate(request.startDate)} – {formatDate(request.endDate)}
          </span>
          <span className="text-muted-foreground ml-2">
            · Submitted {formatDate(request.createdAt)}
          </span>
        </div>
        <div className="text-sm">
          <span className="font-medium">Reason: </span>
          {request.reason}
        </div>
        <Textarea
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          disabled={loading !== null}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="destructive"
          onClick={() => handleAction("decline")}
          disabled={loading !== null}
        >
          {loading === "decline" ? "Declining..." : "Decline"}
        </Button>
        <Button
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
        >
          {loading === "approve" ? "Approving..." : "Approve"}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to `approval-card.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/leaves/approval-card.tsx
git commit -m "feat(approvals): add shared ApprovalCard component"
```

---

### Task 4: Manager Approvals Page

**Files:**
- Create: `src/app/(dashboard)/manager/approvals/page.tsx`

**Interfaces:**
- Consumes:
  - `auth()` from `@/lib/auth`
  - `getPendingManagerRequests(managerId)` from `@/services/leave.service`
  - `ApprovalCard` from `@/components/leaves/approval-card`
  - `managerApproveAction(requestId, comment)` from `./actions`
  - `managerDeclineAction(requestId, comment)` from `./actions`
- Produces: `/manager/approvals` page

- [ ] **Step 1: Create `src/app/(dashboard)/manager/approvals/page.tsx`**

This is a Server Component page that fetches data and renders a Client Component wrapper (because `ApprovalCard` needs to pass server action callbacks). We need a small client wrapper to bind the actions.

Create the page file:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingManagerRequests } from "@/services/leave.service";
import { ManagerApprovalsList } from "./manager-approvals-list";

export default async function ManagerApprovalsPage() {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") redirect("/dashboard");

  const requests = await getPendingManagerRequests(session.user.userId);

  return <ManagerApprovalsList requests={requests} />;
}
```

- [ ] **Step 2: Create the client wrapper `src/app/(dashboard)/manager/approvals/manager-approvals-list.tsx`**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ApprovalCard } from "@/components/leaves/approval-card";
import { managerApproveAction, managerDeclineAction } from "./actions";

interface LeaveRequest {
  id: string;
  totalDays: number;
  reason: string;
  startDate: string | Date;
  endDate: string | Date;
  createdAt: string | Date;
  user: { firstName: string; lastName: string; email: string };
  leaveType: { name: string };
}

interface ManagerApprovalsListProps {
  requests: LeaveRequest[];
}

export function ManagerApprovalsList({ requests }: ManagerApprovalsListProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">Pending Approvals</h1>
        <Badge variant="secondary">{requests.length}</Badge>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground">
          No pending requests to review.
        </p>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {requests.map((request) => (
            <ApprovalCard
              key={request.id}
              request={request}
              onApprove={managerApproveAction}
              onDecline={managerDeclineAction}
            />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify the files compile**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to the manager approvals files.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/manager/approvals/page.tsx src/app/(dashboard)/manager/approvals/manager-approvals-list.tsx
git commit -m "feat(approvals): add manager approvals page"
```

---

### Task 5: HR Approvals Page

**Files:**
- Create: `src/app/(dashboard)/hr/approvals/page.tsx`

**Interfaces:**
- Consumes:
  - `auth()` from `@/lib/auth`
  - `getPendingHRRequests()` from `@/services/leave.service`
  - `ApprovalCard` from `@/components/leaves/approval-card`
  - `hrApproveAction(requestId, comment)` from `./actions`
  - `hrDeclineAction(requestId, comment)` from `./actions`
- Produces: `/hr/approvals` page

- [ ] **Step 1: Create `src/app/(dashboard)/hr/approvals/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingHRRequests } from "@/services/leave.service";
import { HRApprovalsList } from "./hr-approvals-list";

export default async function HRApprovalsPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const requests = await getPendingHRRequests();

  const mapped = requests.map((r) => ({
    ...r,
    departmentName: r.user.department?.name,
  }));

  return <HRApprovalsList requests={mapped} />;
}
```

- [ ] **Step 2: Create the client wrapper `src/app/(dashboard)/hr/approvals/hr-approvals-list.tsx`**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ApprovalCard } from "@/components/leaves/approval-card";
import { hrApproveAction, hrDeclineAction } from "./actions";

interface LeaveRequest {
  id: string;
  totalDays: number;
  reason: string;
  startDate: string | Date;
  endDate: string | Date;
  createdAt: string | Date;
  user: { firstName: string; lastName: string; email: string };
  leaveType: { name: string };
  departmentName?: string;
}

interface HRApprovalsListProps {
  requests: LeaveRequest[];
}

export function HRApprovalsList({ requests }: HRApprovalsListProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">HR Approvals</h1>
        <Badge variant="secondary">{requests.length}</Badge>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground">
          No pending requests to review.
        </p>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {requests.map((request) => (
            <ApprovalCard
              key={request.id}
              request={request}
              onApprove={hrApproveAction}
              onDecline={hrDeclineAction}
            />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify the files compile**

Run: `npx tsc --noEmit --pretty`

Expected: no errors related to the HR approvals files.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/hr/approvals/page.tsx src/app/(dashboard)/hr/approvals/hr-approvals-list.tsx
git commit -m "feat(approvals): add HR approvals page"
```

---

### Task 6: Manual End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Open `http://localhost:3000` in a browser.

- [ ] **Step 2: Test normal approval flow**

1. Log in as an **Employee** who is assigned to a department with leave balances
2. Navigate to **My Leaves** → **Request Leave** → submit a leave request
3. Verify status shows as **Pending Manager** in the leave history table
4. Log out, log in as the **Manager** of that employee's department
5. Navigate to **Approvals** in the sidebar → the employee's request should appear as a card
6. Add a comment, click **Approve** → card disappears from the list
7. Log out, log in as an **HR** user
8. Navigate to **HR Approvals** → the same request should appear with status Pending HR, showing department name
9. Add a comment, click **Approve** → card disappears
10. Log out, log in as the **Employee** → leave history should show the request as **Approved**

- [ ] **Step 3: Test decline flow**

1. Submit a new leave request as an employee
2. As the manager, click **Decline** with a comment → request should disappear from manager approvals
3. As the employee, verify request shows as **Declined** in leave history
4. Verify the leave balance was restored (pendingDays decremented)

- [ ] **Step 4: Test manager self-leave edge case**

1. Log in as a **Manager**
2. Submit a leave request via **My Leaves** → **Request Leave**
3. Verify in the leave history that the status is **Pending HR** (not Pending Manager)
4. The request should NOT appear in the manager's own Approvals page
5. Log in as **HR** → the request should appear in HR Approvals
6. Approve it → status becomes Approved

- [ ] **Step 5: Test authorization guards**

1. As an **Employee**, try to navigate to `/manager/approvals` → should redirect to `/dashboard`
2. As an **Employee**, try to navigate to `/hr/approvals` → should redirect to `/dashboard`
3. As a **Manager**, navigate to **Approvals** → should only see requests from their own department (not other departments)

- [ ] **Step 6: Test edge cases**

1. Submit two requests as different employees in the same department → manager should see both cards
2. Approve one, decline the other → verify balance updates are correct for each
3. Submit a request, cancel it as the employee → verify it does NOT appear in manager approvals
4. Try approving a request that has already been approved (e.g., by opening two browser tabs) → should show an error

- [ ] **Step 7: Commit any fixes found during testing**

If any issues are found during manual testing, fix them and commit:

```bash
git add -A
git commit -m "fix(approvals): address issues found during manual testing"
```
