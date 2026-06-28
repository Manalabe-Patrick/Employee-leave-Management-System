# Phase 9: Notification System — Design Spec

**Date:** 2026-06-28
**Status:** Approved
**Depends on:** Phase 7 (Approval Workflow), Phase 8 (Employee Dashboard)
**Approach:** Service-layer integration (Approach A)

## Overview

Add in-app notifications (bell icon with dropdown in the header) and transactional email notifications via Resend. Notifications are created automatically when leave requests are submitted, approved, declined, or cancelled. The notification bell shows an unread count badge and a dropdown of recent notifications. Clicking a notification marks it as read and navigates to `/leaves`. No real-time updates — notification data refreshes on page navigation.

## Email Configuration

- **Provider:** Resend SDK (already in `package.json`)
- **Sender:** `onboarding@resend.dev` (Resend's built-in test sender)
- **Environment variable:** `RESEND_API_KEY` (required)
- **Email format:** Plain text (no HTML templates)

## Email Utility

**File:** `src/lib/email.ts` (new)

Thin wrapper around the Resend SDK:
- Exports `sendEmail({ to, subject, text })` function
- Initializes the Resend client with `process.env.RESEND_API_KEY`
- Sender hardcoded to `onboarding@resend.dev`
- If `RESEND_API_KEY` is not set, the function fails silently (logs a warning, does not throw)

## Notification Service

**File:** `src/services/notification.service.ts` (new)

### Data Access Functions

**`getUserNotifications(userId: string, limit: number)`**
1. Query `Notification` where `userId` matches
2. Include `leaveRequest` (select `id`)
3. Order by `createdAt` descending
4. Take `limit` results (default: 20)
5. Return the array

**`getUnreadCount(userId: string)`**
1. Count `Notification` where `userId` matches and `isRead` is `false`
2. Return the count

**`markAsRead(notificationId: string, userId: string)`**
1. Find the notification by `id`
2. Verify `userId` matches (ownership check)
3. Update `isRead` to `true`
4. Return the updated notification

**`markAllAsRead(userId: string)`**
1. Update all notifications where `userId` matches and `isRead` is `false`
2. Set `isRead` to `true`
3. Return the count of updated records

### Event Notification Functions

Each function creates an in-app notification record and sends an email in parallel via `Promise.all`. The email send is fire-and-forget — failure does not block the in-app notification.

**`notifyLeaveSubmitted(leaveRequest)`**
- Recipient: department manager (or all HR users if request auto-skipped to PENDING_HR due to manager self-leave)
- Skip if the requester is the same person as the recipient
- Title: "New Leave Request"
- Message: "[Employee Name] has submitted a [Leave Type] request for [Start Date] to [End Date] ([N] days)"
- Email subject: "New Leave Request from [Employee Name]"
- Type: `LEAVE_SUBMITTED`

**`notifyLeaveApproved(leaveRequest)`**
- If manager approved (status moved to PENDING_HR): recipient is all HR users
  - Title: "Leave Request Awaiting HR Approval"
  - Message: "[Employee Name]'s [Leave Type] request has been approved by their manager and needs your review"
  - Type: `LEAVE_APPROVED`
- If HR approved (status is APPROVED): recipient is the employee
  - Title: "Leave Request Approved"
  - Message: "Your [Leave Type] request for [Start Date] to [End Date] has been approved"
  - Type: `LEAVE_APPROVED`

**`notifyLeaveDeclined(leaveRequest, declinerName: string)`**
- Recipient: the employee who submitted the request
- Title: "Leave Request Declined"
- Message: "Your [Leave Type] request for [Start Date] to [End Date] has been declined by [Decliner Name]"
- Email subject: "Leave Request Declined"
- Type: `LEAVE_DECLINED`

**`notifyLeaveCancelled(leaveRequest)`**
- Recipient: department manager (if request was at PENDING_MANAGER) or department manager + all HR users (if request was at PENDING_HR)
- Skip if the canceller is the same person as the recipient
- Title: "Leave Request Cancelled"
- Message: "[Employee Name] has cancelled their [Leave Type] request for [Start Date] to [End Date]"
- Type: `LEAVE_CANCELLED`

### Data Requirements for Notification Functions

The `leaveRequest` parameter passed to notification functions must include:
- `id`, `startDate`, `endDate`, `totalDays`, `status`
- `user`: `{ id, firstName, lastName, email, departmentId }`
- `leaveType`: `{ name }`

The notification service fetches the department manager and HR users internally as needed.

## Notification Bell Component

**File:** `src/components/layout/notification-bell.tsx` (new Client Component)

**Props:**
- `notifications` — array of notification objects: `{ id, title, message, type, isRead, createdAt, leaveRequest: { id } | null }`
- `unreadCount` — number

**Rendering:**
- Bell icon from `lucide-react` (`Bell`)
- If `unreadCount > 0`, show a small badge with the count (max display: "9+")
- Uses `DropdownMenu` component (already exists in the project)

**Dropdown content:**
- Header: "Notifications" title
- List of notifications (max 20):
  - Each item shows: title (bold), message (truncated), relative time ("2 hours ago")
  - Unread notifications have a blue dot indicator
  - Clicking a notification: calls `PATCH /api/notifications/[id]` to mark as read, then navigates to `/leaves`
- Footer: "Mark all as read" button — calls `PATCH /api/notifications` to mark all as read
- Empty state: "No notifications" centered text

**Relative time:** Simple helper function inside the component file — no external library. Handles: "just now", "N minutes ago", "N hours ago", "N days ago", "N weeks ago".

## Header Integration

**File:** `src/components/layout/header.tsx` (modify)

- Add two new props to `HeaderProps`: `notifications` (array) and `unreadCount` (number)
- Render `NotificationBell` to the left of the user dropdown menu
- Separated from the user menu by a small gap

## Dashboard Layout Integration

**File:** `src/app/(dashboard)/layout.tsx` (modify)

- Import `getUserNotifications` and `getUnreadCount` from `notification.service.ts`
- After authenticating, fetch notifications and unread count in parallel with existing session data
- Pass `notifications` and `unreadCount` as props to `Header`

## API Routes

**File:** `src/app/api/notifications/route.ts` (new)

`GET`:
1. Authenticate via `auth()`; return 401 if not logged in
2. Call `getUserNotifications(userId, 20)`
3. Return JSON array

`PATCH`:
1. Authenticate via `auth()`; return 401 if not logged in
2. Call `markAllAsRead(userId)`
3. Return `{ success: true, count }` with count of updated records

**File:** `src/app/api/notifications/[id]/route.ts` (new)

`PATCH`:
1. Authenticate via `auth()`; return 401 if not logged in
2. Call `markAsRead(notificationId, userId)`
3. If notification not found or userId doesn't match, return 404
4. Return the updated notification as JSON

## Server Action Modifications

### `src/app/(dashboard)/leaves/actions.ts`

**`submitLeaveRequestAction`:**
- After `submitLeaveRequest()` succeeds, re-fetch the created request with user and leaveType includes
- Call `notifyLeaveSubmitted(request)` (fire-and-forget, don't await or let it block the response)
- Add `revalidatePath("/")` to refresh notification data in the header

**`cancelLeaveRequestAction`:**
- After `cancelLeaveRequest()` succeeds, re-fetch the request with user and leaveType includes
- Call `notifyLeaveCancelled(request)` (fire-and-forget)
- Add `revalidatePath("/")` to refresh notification data

### `src/app/(dashboard)/manager/approvals/actions.ts`

**`managerApproveAction`:**
- After `reviewLeaveRequest()` succeeds, fetch the updated request with user and leaveType includes
- Call `notifyLeaveApproved(request)` (fire-and-forget)
- Add `revalidatePath("/")` to refresh notification data

**`managerDeclineAction`:**
- After `reviewLeaveRequest()` succeeds, fetch the updated request with user and leaveType includes
- Get the manager's name from the session
- Call `notifyLeaveDeclined(request, managerName)` (fire-and-forget)
- Add `revalidatePath("/")` to refresh notification data

### `src/app/(dashboard)/hr/approvals/actions.ts`

**`hrApproveAction`:**
- After `reviewLeaveRequest()` succeeds, fetch the updated request with user and leaveType includes
- Call `notifyLeaveApproved(request)` (fire-and-forget)
- Add `revalidatePath("/")` to refresh notification data

**`hrDeclineAction`:**
- After `reviewLeaveRequest()` succeeds, fetch the updated request with user and leaveType includes
- Get the HR user's name from the session
- Call `notifyLeaveDeclined(request, hrName)` (fire-and-forget)
- Add `revalidatePath("/")` to refresh notification data

## File Summary

| File | Type | Purpose |
|------|------|---------|
| `src/lib/email.ts` | Utility (new) | Resend email wrapper |
| `src/services/notification.service.ts` | Service (new) | Notification CRUD + event notification functions |
| `src/components/layout/notification-bell.tsx` | Component (new) | Bell icon with dropdown |
| `src/app/api/notifications/route.ts` | API route (new) | GET notifications, PATCH mark-all-read |
| `src/app/api/notifications/[id]/route.ts` | API route (new) | PATCH mark-single-read |
| `src/components/layout/header.tsx` | Component (modify) | Add notification bell |
| `src/app/(dashboard)/layout.tsx` | Layout (modify) | Fetch notifications for header |
| `src/app/(dashboard)/leaves/actions.ts` | Actions (modify) | Add submit/cancel notifications |
| `src/app/(dashboard)/manager/approvals/actions.ts` | Actions (modify) | Add approve/decline notifications |
| `src/app/(dashboard)/hr/approvals/actions.ts` | Actions (modify) | Add approve/decline notifications |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No department manager found | Skip manager notification (log warning, don't throw) |
| No HR users in system | Skip HR notification (log warning, don't throw) |
| `RESEND_API_KEY` missing | Email send fails silently with console warning; in-app notification still created |
| User would notify themselves | Skipped (e.g., manager doesn't get notified about their own auto-approved request) |
| Notification for deleted leave request | `relatedLeaveRequestId` set to null via `onDelete: SetNull` (already in Prisma schema) |
| Notification send fails | Does not block the main action — notifications are fire-and-forget |
| Unread count exceeds 9 | Badge shows "9+" |

## Test Plan

1. Submit a leave request as Employee → department manager gets in-app notification + email
2. Approve as Manager → HR users get notification; approve as HR → employee gets notification
3. Decline at either stage → employee gets notification with decliner's name
4. Cancel a pending request → manager (and HR if at PENDING_HR) gets notification
5. Manager submits own leave (auto-skips manager stage) → HR gets notification, not the manager
6. Click notification bell → dropdown shows recent notifications with unread indicators
7. Click a notification → marked as read, navigates to `/leaves`
8. Click "Mark all as read" → all unread notifications marked as read, badge disappears
9. No notifications → dropdown shows "No notifications" message
