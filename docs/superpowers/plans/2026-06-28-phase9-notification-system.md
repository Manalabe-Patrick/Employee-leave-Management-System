# Phase 9: Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app notifications (bell icon with dropdown) and transactional email via Resend, triggered automatically on leave request submit/approve/decline/cancel.

**Architecture:** A new notification service creates in-app notification records and sends emails via Resend when leave events occur. Existing server actions call into this service after their main operation (fire-and-forget). A notification bell Client Component in the header shows unread count and a dropdown of recent notifications; data is fetched server-side in the dashboard layout and passed as props. Two API routes handle marking notifications as read.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma (existing Notification model), Resend SDK (`resend` package, already installed), `@base-ui/react` DropdownMenu, `lucide-react` icons.

## Global Constraints

- Next.js 16 — check `node_modules/next/dist/docs/` before using unfamiliar APIs
- UI components use `@base-ui/react` (NOT Radix UI) — see existing `src/components/ui/dropdown-menu.tsx` for patterns
- Prisma `Notification` model and `NotificationType` enum already exist in `prisma/schema.prisma` — no schema changes needed
- Auth via `auth()` from `src/lib/auth.ts` (NextAuth v5 beta.31, JWT strategy)
- Session has `userId`, `name`, `email`, `role`, `departmentId`
- Prisma client imported as `db` from `src/lib/db`
- All dates in the database use UTC; display formatting uses `toLocaleDateString()`
- Email sender: `onboarding@resend.dev` (Resend built-in test address)
- Env var: `RESEND_API_KEY` required for email; if missing, email fails silently

---

### Task 1: Email Utility + Notification Service (data access functions)

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/services/notification.service.ts`

**Interfaces:**
- Consumes: `db` from `src/lib/db`, Prisma `Notification` model
- Produces:
  - `sendEmail({ to: string, subject: string, text: string }): Promise<void>`
  - `getUserNotifications(userId: string, limit?: number): Promise<Notification[]>` (with `leaveRequest: { id } | null`)
  - `getUnreadCount(userId: string): Promise<number>`
  - `markAsRead(notificationId: string, userId: string): Promise<Notification | null>`
  - `markAllAsRead(userId: string): Promise<number>`

- [ ] **Step 1: Create email utility**

Create `src/lib/email.ts`:

```typescript
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping email send");
    return;
  }

  try {
    await resend.emails.send({
      from: "Leave Management <onboarding@resend.dev>",
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("[email] Failed to send email:", error);
  }
}
```

- [ ] **Step 2: Create notification service with data access functions**

Create `src/services/notification.service.ts`:

```typescript
import { db } from "@/lib/db";

export async function getUserNotifications(userId: string, limit: number = 20) {
  return db.notification.findMany({
    where: { userId },
    include: {
      leaveRequest: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount(userId: string) {
  return db.notification.count({
    where: { userId, isRead: false },
  });
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    return null;
  }

  return db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`

Expected: No type errors related to the new files. (Build may fail for other reasons — only check for errors in `email.ts` or `notification.service.ts`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/email.ts src/services/notification.service.ts
git commit -m "feat(notifications): add email utility and notification service data access"
```

---

### Task 2: Notification Service (event notification functions)

**Files:**
- Modify: `src/services/notification.service.ts`

**Interfaces:**
- Consumes: `sendEmail` from `src/lib/email`, `db` from `src/lib/db`
- Produces:
  - `notifyLeaveSubmitted(leaveRequest: LeaveRequestWithDetails): Promise<void>`
  - `notifyLeaveApproved(leaveRequest: LeaveRequestWithDetails): Promise<void>`
  - `notifyLeaveDeclined(leaveRequest: LeaveRequestWithDetails, declinerName: string): Promise<void>`
  - `notifyLeaveCancelled(leaveRequest: LeaveRequestWithDetails): Promise<void>`
  - `getLeaveRequestWithDetails(requestId: string): Promise<LeaveRequestWithDetails | null>` (helper for server actions)

The `LeaveRequestWithDetails` type:
```typescript
type LeaveRequestWithDetails = {
  id: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; departmentId: string | null };
  leaveType: { name: string };
}
```

- [ ] **Step 1: Add imports and helper type/functions**

Add to the top of `src/services/notification.service.ts`, after the existing `db` import:

```typescript
import { sendEmail } from "@/lib/email";

type LeaveRequestWithDetails = {
  id: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; departmentId: string | null };
  leaveType: { name: string };
};

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function getDepartmentManager(departmentId: string) {
  const dept = await db.department.findUnique({
    where: { id: departmentId },
    include: { manager: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  return dept?.manager ?? null;
}

async function getAllHRUsers() {
  return db.user.findMany({
    where: { role: "HR" },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
}
```

- [ ] **Step 2: Add `getLeaveRequestWithDetails` helper**

Append to `src/services/notification.service.ts`:

```typescript
export async function getLeaveRequestWithDetails(requestId: string) {
  return db.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } },
      leaveType: { select: { name: true } },
    },
  });
}
```

- [ ] **Step 3: Add `notifyLeaveSubmitted`**

Append to `src/services/notification.service.ts`:

```typescript
export async function notifyLeaveSubmitted(leaveRequest: LeaveRequestWithDetails) {
  const { user, leaveType } = leaveRequest;
  const employeeName = `${user.firstName} ${user.lastName}`;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;
  const title = "New Leave Request";
  const message = `${employeeName} has submitted a ${leaveType.name} request for ${dateRange} (${leaveRequest.totalDays} day${leaveRequest.totalDays === 1 ? "" : "s"})`;
  const emailSubject = `New Leave Request from ${employeeName}`;

  if (leaveRequest.status === "PENDING_HR") {
    const hrUsers = await getAllHRUsers();
    const recipients = hrUsers.filter((hr) => hr.id !== user.id);
    if (recipients.length === 0) {
      console.warn("[notifications] No HR users to notify for submitted leave request");
      return;
    }
    await Promise.all(
      recipients.flatMap((hr) => [
        db.notification.create({
          data: { userId: hr.id, title, message, type: "LEAVE_SUBMITTED", relatedLeaveRequestId: leaveRequest.id },
        }),
        sendEmail({ to: hr.email, subject: emailSubject, text: message }),
      ])
    );
    return;
  }

  if (!user.departmentId) {
    console.warn("[notifications] No department for user, cannot notify manager");
    return;
  }

  const manager = await getDepartmentManager(user.departmentId);
  if (!manager || manager.id === user.id) {
    return;
  }

  await Promise.all([
    db.notification.create({
      data: { userId: manager.id, title, message, type: "LEAVE_SUBMITTED", relatedLeaveRequestId: leaveRequest.id },
    }),
    sendEmail({ to: manager.email, subject: emailSubject, text: message }),
  ]);
}
```

- [ ] **Step 4: Add `notifyLeaveApproved`**

Append to `src/services/notification.service.ts`:

```typescript
export async function notifyLeaveApproved(leaveRequest: LeaveRequestWithDetails) {
  const { user, leaveType } = leaveRequest;
  const employeeName = `${user.firstName} ${user.lastName}`;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;

  if (leaveRequest.status === "PENDING_HR") {
    const title = "Leave Request Awaiting HR Approval";
    const message = `${employeeName}'s ${leaveType.name} request has been approved by their manager and needs your review`;
    const hrUsers = await getAllHRUsers();
    const recipients = hrUsers.filter((hr) => hr.id !== user.id);
    if (recipients.length === 0) {
      console.warn("[notifications] No HR users to notify for approved leave request");
      return;
    }
    await Promise.all(
      recipients.flatMap((hr) => [
        db.notification.create({
          data: { userId: hr.id, title, message, type: "LEAVE_APPROVED", relatedLeaveRequestId: leaveRequest.id },
        }),
        sendEmail({ to: hr.email, subject: `Leave Request Awaiting Approval: ${employeeName}`, text: message }),
      ])
    );
    return;
  }

  if (leaveRequest.status === "APPROVED") {
    const title = "Leave Request Approved";
    const message = `Your ${leaveType.name} request for ${dateRange} has been approved`;
    await Promise.all([
      db.notification.create({
        data: { userId: user.id, title, message, type: "LEAVE_APPROVED", relatedLeaveRequestId: leaveRequest.id },
      }),
      sendEmail({ to: user.email, subject: "Leave Request Approved", text: message }),
    ]);
  }
}
```

- [ ] **Step 5: Add `notifyLeaveDeclined`**

Append to `src/services/notification.service.ts`:

```typescript
export async function notifyLeaveDeclined(leaveRequest: LeaveRequestWithDetails, declinerName: string) {
  const { user, leaveType } = leaveRequest;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;
  const title = "Leave Request Declined";
  const message = `Your ${leaveType.name} request for ${dateRange} has been declined by ${declinerName}`;

  await Promise.all([
    db.notification.create({
      data: { userId: user.id, title, message, type: "LEAVE_DECLINED", relatedLeaveRequestId: leaveRequest.id },
    }),
    sendEmail({ to: user.email, subject: "Leave Request Declined", text: message }),
  ]);
}
```

- [ ] **Step 6: Add `notifyLeaveCancelled`**

Append to `src/services/notification.service.ts`:

```typescript
export async function notifyLeaveCancelled(leaveRequest: LeaveRequestWithDetails) {
  const { user, leaveType } = leaveRequest;
  const employeeName = `${user.firstName} ${user.lastName}`;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;
  const title = "Leave Request Cancelled";
  const message = `${employeeName} has cancelled their ${leaveType.name} request for ${dateRange}`;

  const recipients: { id: string; email: string }[] = [];

  if (user.departmentId) {
    const manager = await getDepartmentManager(user.departmentId);
    if (manager && manager.id !== user.id) {
      recipients.push(manager);
    }
  }

  if (leaveRequest.status === "PENDING_HR") {
    const hrUsers = await getAllHRUsers();
    for (const hr of hrUsers) {
      if (hr.id !== user.id && !recipients.some((r) => r.id === hr.id)) {
        recipients.push(hr);
      }
    }
  }

  if (recipients.length === 0) return;

  await Promise.all(
    recipients.flatMap((recipient) => [
      db.notification.create({
        data: { userId: recipient.id, title, message, type: "LEAVE_CANCELLED", relatedLeaveRequestId: leaveRequest.id },
      }),
      sendEmail({ to: recipient.email, subject: `Leave Request Cancelled: ${employeeName}`, text: message }),
    ])
  );
}
```

- [ ] **Step 7: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`

Expected: No type errors in `notification.service.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/services/notification.service.ts
git commit -m "feat(notifications): add event notification functions with email"
```

---

### Task 3: API Routes for Notifications

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/[id]/route.ts`

**Interfaces:**
- Consumes: `auth()` from `src/lib/auth`, `getUserNotifications`, `markAllAsRead`, `markAsRead` from `src/services/notification.service`
- Produces:
  - `GET /api/notifications` → JSON array of notifications
  - `PATCH /api/notifications` → `{ success: true, count: number }`
  - `PATCH /api/notifications/[id]` → updated notification JSON or 404

- [ ] **Step 1: Create notifications list/mark-all route**

Create `src/app/api/notifications/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getUserNotifications, markAllAsRead } from "@/services/notification.service";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await getUserNotifications(session.user.userId, 20);
  return NextResponse.json(notifications);
}

export async function PATCH() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await markAllAsRead(session.user.userId);
  return NextResponse.json({ success: true, count });
}
```

- [ ] **Step 2: Create single notification mark-read route**

Create `src/app/api/notifications/[id]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { markAsRead } from "@/services/notification.service";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const notification = await markAsRead(id, session.user.userId);

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json(notification);
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`

Expected: No type errors in the new route files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/notifications/route.ts src/app/api/notifications/\[id\]/route.ts
git commit -m "feat(notifications): add API routes for reading and marking notifications"
```

---

### Task 4: Notification Bell Component

**Files:**
- Create: `src/components/layout/notification-bell.tsx`

**Interfaces:**
- Consumes: `DropdownMenu*` components from `src/components/ui/dropdown-menu`, `Bell` icon from `lucide-react`
- Produces: `NotificationBell` component with props `{ notifications: NotificationItem[], unreadCount: number }`

The `NotificationItem` type:
```typescript
type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date | string;
  leaveRequest: { id: string } | null;
}
```

- [ ] **Step 1: Create the NotificationBell component**

Create `src/components/layout/notification-bell.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date | string;
  leaveRequest: { id: string } | null;
};

function timeAgo(date: Date | string) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  async function handleNotificationClick(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    router.push("/leaves");
  }

  async function handleMarkAllAsRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="relative" />}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-80">
        <DropdownMenuLabel className="text-sm font-semibold text-foreground">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <DropdownMenuGroup>
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification.id)}
                className="flex items-start gap-2 whitespace-normal py-2"
              >
                {!notification.isRead && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
                )}
                <div className={`flex-1 ${notification.isRead ? "pl-4" : ""}`}>
                  <p className="text-sm font-medium leading-tight">{notification.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {timeAgo(notification.createdAt)}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
        {notifications.length > 0 && unreadCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleMarkAllAsRead}
              className="justify-center text-xs font-medium text-blue-600"
            >
              Mark all as read
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`

Expected: No type errors in `notification-bell.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/notification-bell.tsx
git commit -m "feat(notifications): add NotificationBell component with dropdown"
```

---

### Task 5: Header + Layout Integration

**Files:**
- Modify: `src/components/layout/header.tsx:19-25` (update `HeaderProps`)
- Modify: `src/components/layout/header.tsx:41` (add bell before user menu)
- Modify: `src/app/(dashboard)/layout.tsx:1-7` (add imports)
- Modify: `src/app/(dashboard)/layout.tsx:13-27` (fetch + pass notification data)

**Interfaces:**
- Consumes: `NotificationBell` from `src/components/layout/notification-bell`, `getUserNotifications` and `getUnreadCount` from `src/services/notification.service`
- Produces: Header renders notification bell; layout passes notification data to header

- [ ] **Step 1: Update Header component to accept and render notification bell**

In `src/components/layout/header.tsx`:

Add import at the top (after existing imports):
```typescript
import { NotificationBell } from "@/components/layout/notification-bell";
```

Replace the `HeaderProps` type (lines 19-25) with:
```typescript
type HeaderProps = {
  user: {
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
  };
  notifications: {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: Date | string;
    leaveRequest: { id: string } | null;
  }[];
  unreadCount: number;
};
```

Update the function signature (line 27) from:
```typescript
export function Header({ user }: HeaderProps) {
```
to:
```typescript
export function Header({ user, notifications, unreadCount }: HeaderProps) {
```

Add the notification bell inside the `<div className="ml-auto">` div, before the user `DropdownMenu`. Replace the line `<div className="ml-auto">` (line 41) with:
```typescript
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
```

- [ ] **Step 2: Update dashboard layout to fetch and pass notification data**

In `src/app/(dashboard)/layout.tsx`:

Add import (after existing imports):
```typescript
import { getUserNotifications, getUnreadCount } from "@/services/notification.service";
```

Replace lines 13-27 (from `const session` through the `return` opening) with:
```typescript
  const session = await auth();
  if (!session) redirect("/login");

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(session.user.userId),
    getUnreadCount(session.user.userId),
  ]);

  const serializedNotifications = notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <Header user={user} notifications={serializedNotifications} unreadCount={unreadCount} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`

Expected: No type errors. The notification bell should now render in the header (though with no notifications yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/header.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat(notifications): integrate bell into header with server-side data"
```

---

### Task 6: Wire Up Server Actions to Send Notifications

**Files:**
- Modify: `src/app/(dashboard)/leaves/actions.ts:1-9` (add imports)
- Modify: `src/app/(dashboard)/leaves/actions.ts:38-51` (add notification to submit)
- Modify: `src/app/(dashboard)/leaves/actions.ts:57-66` (add notification to cancel)
- Modify: `src/app/(dashboard)/manager/approvals/actions.ts:1-5` (add imports)
- Modify: `src/app/(dashboard)/manager/approvals/actions.ts:13-27` (add notification to approve)
- Modify: `src/app/(dashboard)/manager/approvals/actions.ts:29-43` (add notification to decline)
- Modify: `src/app/(dashboard)/hr/approvals/actions.ts:1-5` (add imports)
- Modify: `src/app/(dashboard)/hr/approvals/actions.ts:13-27` (add notification to approve)
- Modify: `src/app/(dashboard)/hr/approvals/actions.ts:29-43` (add notification to decline)

**Interfaces:**
- Consumes: `notifyLeaveSubmitted`, `notifyLeaveApproved`, `notifyLeaveDeclined`, `notifyLeaveCancelled`, `getLeaveRequestWithDetails` from `src/services/notification.service`
- Produces: Existing server actions now trigger notifications after successful operations

- [ ] **Step 1: Update leaves/actions.ts**

In `src/app/(dashboard)/leaves/actions.ts`, add import after existing imports:

```typescript
import {
  notifyLeaveSubmitted,
  notifyLeaveCancelled,
  getLeaveRequestWithDetails,
} from "@/services/notification.service";
```

Replace the `submitLeaveRequestAction` try/catch block and the lines after it (lines 38-51) with:

```typescript
  let createdId: string;
  try {
    const result = await submitLeaveRequest(session.user.userId, {
      leaveTypeId,
      startDate,
      endDate,
      reason: reason.trim(),
    });
    createdId = result.id;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit leave request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(createdId);
  if (request) {
    notifyLeaveSubmitted(request).catch(() => {});
  }

  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
```

Replace the `cancelLeaveRequestAction` try/catch block and lines after it (lines 57-66) with:

```typescript
  // Fetch BEFORE cancelling — notifyLeaveCancelled needs the pre-cancel status
  // to know whether HR was involved (PENDING_HR) or just the manager (PENDING_MANAGER)
  const requestDetails = await getLeaveRequestWithDetails(requestId);

  try {
    await cancelLeaveRequest(session.user.userId, requestId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel leave request";
    return { success: false, error: message };
  }

  if (requestDetails) {
    notifyLeaveCancelled(requestDetails).catch(() => {});
  }

  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
```

- [ ] **Step 2: Update manager/approvals/actions.ts**

In `src/app/(dashboard)/manager/approvals/actions.ts`, add import after existing imports:

```typescript
import {
  notifyLeaveApproved,
  notifyLeaveDeclined,
  getLeaveRequestWithDetails,
} from "@/services/notification.service";
```

Replace the `managerApproveAction` function body (lines 13-27) with:

```typescript
export async function managerApproveAction(requestId: string, comment: string) {
  const session = await requireManager();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "approve", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to approve request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(requestId);
  if (request) {
    notifyLeaveApproved(request).catch(() => {});
  }

  revalidatePath("/manager/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}
```

Replace the `managerDeclineAction` function body (lines 29-43) with:

```typescript
export async function managerDeclineAction(requestId: string, comment: string) {
  const session = await requireManager();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "decline", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to decline request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(requestId);
  if (request) {
    notifyLeaveDeclined(request, session.user.name).catch(() => {});
  }

  revalidatePath("/manager/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}
```

- [ ] **Step 3: Update hr/approvals/actions.ts**

In `src/app/(dashboard)/hr/approvals/actions.ts`, add import after existing imports:

```typescript
import {
  notifyLeaveApproved,
  notifyLeaveDeclined,
  getLeaveRequestWithDetails,
} from "@/services/notification.service";
```

Replace the `hrApproveAction` function body (lines 13-27) with:

```typescript
export async function hrApproveAction(requestId: string, comment: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "approve", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to approve request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(requestId);
  if (request) {
    notifyLeaveApproved(request).catch(() => {});
  }

  revalidatePath("/hr/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}
```

Replace the `hrDeclineAction` function body (lines 29-43) with:

```typescript
export async function hrDeclineAction(requestId: string, comment: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "decline", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to decline request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(requestId);
  if (request) {
    notifyLeaveDeclined(request, session.user.name).catch(() => {});
  }

  revalidatePath("/hr/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}
```

- [ ] **Step 4: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`

Expected: No type errors in any of the modified action files.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/leaves/actions.ts src/app/\(dashboard\)/manager/approvals/actions.ts src/app/\(dashboard\)/hr/approvals/actions.ts
git commit -m "feat(notifications): wire up server actions to send notifications on leave events"
```

---

### Task 7: Manual Testing

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test notification bell rendering**

1. Login as any user
2. Verify the bell icon appears in the header to the left of the user menu
3. Click the bell → dropdown should show "No notifications"

- [ ] **Step 3: Test leave submission notifications**

1. Login as an Employee (must be assigned to a department)
2. Submit a leave request at `/leaves/new`
3. Log out and login as the department's Manager
4. Verify: bell shows "1" unread badge
5. Click bell → shows "New Leave Request" notification with employee name and dates
6. Click the notification → navigates to `/leaves`, notification marked as read

- [ ] **Step 4: Test approval notifications**

1. As Manager, go to `/manager/approvals` and approve the request
2. Log out and login as HR
3. Verify: bell shows notification "Leave Request Awaiting HR Approval"
4. Go to `/hr/approvals` and approve the request
5. Log out and login as the original Employee
6. Verify: bell shows "Leave Request Approved" notification

- [ ] **Step 5: Test decline notifications**

1. Submit another leave request as Employee
2. Login as Manager, decline the request
3. Login as Employee → bell shows "Leave Request Declined" with manager's name

- [ ] **Step 6: Test mark all as read**

1. With multiple unread notifications visible
2. Click bell → click "Mark all as read"
3. Verify: all blue dots disappear, badge disappears

- [ ] **Step 7: Commit any fixes**

If any fixes were needed during testing:
```bash
git add -A
git commit -m "fix(notifications): address issues found during manual testing"
```
