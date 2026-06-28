# Phase 7: Approval Workflow — Design Spec

**Date:** 2026-06-28
**Status:** Approved
**Depends on:** Phase 6 (Leave Request & History)
**Approach:** Server Actions (consistent with Phases 4-6), Unified Approval Service (Approach A)

## Overview

Managers approve or decline leave requests from their department. HR gives final approval or decline. The system handles edge cases where a manager or HR user submits their own leave. Balance updates occur atomically: approve moves `pendingDays` to `usedDays`; decline decrements `pendingDays`.

## Service Layer

All approval logic lives in `src/services/leave.service.ts` (extending the existing file).

### `reviewLeaveRequest(reviewerId: string, requestId: string, action: "approve" | "decline", comment?: string)`

Runs inside a Prisma transaction:

1. Fetch the leave request (include `user` with `departmentId`, and `leaveType`)
2. Fetch the reviewer user
3. **Authorization:**
   - Reject if `reviewerId === request.userId` (no self-approval at any stage)
   - If request status is `PENDING_MANAGER`:
     - Reviewer must have `MANAGER` role
     - Reviewer must be the manager of the requester's department (query `Department` where `managerId === reviewerId` and `id === request.user.departmentId`)
     - Reject if either check fails
   - If request status is `PENDING_HR`:
     - Reviewer must have `HR` role
     - Reject if not
   - If request status is anything else (`APPROVED`, `DECLINED`, `CANCELLED`):
     - Reject — request is already resolved
4. **Action = "approve":**
   - If current status is `PENDING_MANAGER`:
     - Update status to `PENDING_HR`
     - Set `reviewedByManagerId = reviewerId`, `managerComment = comment`, `managerReviewedAt = now()`
   - If current status is `PENDING_HR`:
     - Update status to `APPROVED`
     - Set `reviewedByHRId = reviewerId`, `hrComment = comment`, `hrReviewedAt = now()`
     - Decrement `pendingDays` by `totalDays` on the user's `LeaveBalance`
     - Increment `usedDays` by `totalDays` on the user's `LeaveBalance`
5. **Action = "decline":**
   - If current status is `PENDING_MANAGER`:
     - Update status to `DECLINED`
     - Set `reviewedByManagerId = reviewerId`, `managerComment = comment`, `managerReviewedAt = now()`
   - If current status is `PENDING_HR`:
     - Update status to `DECLINED`
     - Set `reviewedByHRId = reviewerId`, `hrComment = comment`, `hrReviewedAt = now()`
   - In both cases: decrement `pendingDays` by `totalDays` on the user's `LeaveBalance`

### `getPendingManagerRequests(managerId: string)`

1. Find the department where `managerId` matches the given ID
2. If no department found, return empty array (user is not managing any department)
3. Fetch all leave requests where:
   - `status === "PENDING_MANAGER"`
   - `user.departmentId === department.id`
4. Include: `user` (firstName, lastName, email), `leaveType` (name)
5. Order by `createdAt` ascending (oldest first, so they get reviewed in order)

### `getPendingHRRequests()`

1. Fetch all leave requests where `status === "PENDING_HR"`
2. Include: `user` (firstName, lastName, email, department with name), `leaveType` (name)
3. Order by `createdAt` ascending

### Modification to `submitLeaveRequest`

Add edge-case handling after the request is created (within the existing transaction):

**Manager self-leave:** After creating the request, check if the submitting user is the manager of their own department (query `Department` where `managerId === userId` and `id === user.departmentId`). If so:
- Set status to `PENDING_HR` instead of `PENDING_MANAGER`
- Set `reviewedByManagerId = userId`, `managerReviewedAt = now()`

**HR self-leave:** If the user has role `HR` and the request status after the manager check is `PENDING_HR` (either because it was auto-skipped as a manager, or because an HR user who is also a manager submitted):
- Do NOT auto-approve at submit time for HR
- HR self-leave goes through the normal flow: `PENDING_MANAGER` first (their department manager reviews), then `PENDING_HR` where another HR user reviews
- Exception: if the HR user is also the manager of their own department, the manager stage is auto-skipped (same as any manager), and the request goes to `PENDING_HR` for another HR user to review

**Rationale:** The original spec says "HR self-leave auto-approves at HR stage," but this creates a loophole where HR users can approve their own leave with zero independent review. Instead, we ensure at least one independent reviewer at all times. If the HR user is also a department manager, the manager stage is auto-skipped (they can't review their own request), and the request goes to `PENDING_HR` for a different HR user. If the HR user is not a manager, their department manager reviews first at `PENDING_MANAGER`, then a different HR user reviews at `PENDING_HR`.

## Server Actions

### Manager Actions — `src/app/(dashboard)/manager/approvals/actions.ts`

#### `managerApproveAction(requestId: string, comment: string)`

1. Authenticate via `auth()`; reject if not logged in
2. Verify `session.user.role === "MANAGER"`; reject if not
3. Call `reviewLeaveRequest(session.user.userId, requestId, "approve", comment)`
4. On success: `revalidatePath("/manager/approvals")`, return `{ success: true }`
5. On failure: return `{ success: false, error: "<message>" }`

#### `managerDeclineAction(requestId: string, comment: string)`

Same as above but with `"decline"`.

### HR Actions — `src/app/(dashboard)/hr/approvals/actions.ts`

#### `hrApproveAction(requestId: string, comment: string)`

1. Authenticate via `auth()`; reject if not logged in
2. Verify `session.user.role === "HR"`; reject if not
3. Call `reviewLeaveRequest(session.user.userId, requestId, "approve", comment)`
4. On success: `revalidatePath("/hr/approvals")`, return `{ success: true }`
5. On failure: return `{ success: false, error: "<message>" }`

#### `hrDeclineAction(requestId: string, comment: string)`

Same as above but with `"decline"`.

All actions return `{ success: boolean; error?: string }`.

## Pages

### `/manager/approvals` — Manager Approvals Page

**File:** `src/app/(dashboard)/manager/approvals/page.tsx` (Server Component)

- Authenticates user, verifies role is `MANAGER`, redirects to `/dashboard` if not
- Fetches pending requests via `getPendingManagerRequests(session.user.userId)`
- Renders heading: "Pending Approvals" with count badge
- Maps requests to `ApprovalCard` components
- Empty state: "No pending requests to review" message

### `/hr/approvals` — HR Approvals Page

**File:** `src/app/(dashboard)/hr/approvals/page.tsx` (Server Component)

- Authenticates user, verifies role is `HR`, redirects to `/dashboard` if not
- Fetches pending requests via `getPendingHRRequests()`
- Renders heading: "HR Approvals" with count badge
- Maps requests to `ApprovalCard` components, additionally showing department name
- Empty state: "No pending requests to review" message

## Components

### `ApprovalCard` (`src/components/leaves/approval-card.tsx`)

Client component. Reused by both manager and HR pages.

**Props:**
- `request` — object containing:
  - `id`, `totalDays`, `reason`, `startDate`, `endDate`, `createdAt`
  - `user`: `{ firstName, lastName, email }`
  - `leaveType`: `{ name }`
  - `departmentName?`: string (shown on HR page, omitted on manager page)
- `onApprove: (requestId: string, comment: string) => Promise<{ success: boolean; error?: string }>`
- `onDecline: (requestId: string, comment: string) => Promise<{ success: boolean; error?: string }>`

**Card layout:**
- **Header area:** Employee full name, department name (if provided), leave type name with day count
- **Body:** Date range (formatted as "Jul 7 – Jul 11, 2026"), reason text, submission date
- **Footer area:** Comment textarea (optional, placeholder: "Add a comment..."), Decline button (destructive variant, left side), Approve button (primary, right side)
- **States:** Loading spinner on buttons while action is in flight, disabled buttons during loading, error message display below the comment field

Uses existing shadcn components: `Card`, `CardHeader`, `CardContent`, `CardFooter`, `Button`, `Textarea`, `Badge`.

## File Summary

| File | Type | Purpose |
|------|------|---------|
| `src/services/leave.service.ts` | Service (extend) | Add `reviewLeaveRequest`, `getPendingManagerRequests`, `getPendingHRRequests`; modify `submitLeaveRequest` for self-leave edge cases |
| `src/app/(dashboard)/manager/approvals/actions.ts` | Server Actions (new) | Manager approve/decline actions |
| `src/app/(dashboard)/hr/approvals/actions.ts` | Server Actions (new) | HR approve/decline actions |
| `src/app/(dashboard)/manager/approvals/page.tsx` | Page (new) | Manager approvals page |
| `src/app/(dashboard)/hr/approvals/page.tsx` | Page (new) | HR approvals page |
| `src/components/leaves/approval-card.tsx` | Component (new) | Shared approval card component |

## Edge Cases Summary

| Scenario | Behavior |
|----------|----------|
| Manager submits own leave | Auto-skips manager stage → `PENDING_HR` |
| HR user submits leave (not a manager) | Normal flow: `PENDING_MANAGER` → department manager reviews → `PENDING_HR` → different HR user reviews |
| HR user who is also department manager submits leave | Manager stage auto-skipped → `PENDING_HR` → different HR user reviews |
| Manager tries to approve request from another department | Rejected by service |
| Non-manager tries to access manager approvals page | Redirected to dashboard |
| Non-HR tries to access HR approvals page | Redirected to dashboard |
| Any user tries to approve/decline their own request | Rejected — no self-approval |
| Request already approved/declined/cancelled | Reject review action |

## Validation Rules Summary

- Reviewer must be authenticated
- Manager reviewer must own the requester's department
- HR reviewer must have HR role
- Request must be in the correct pending status for the reviewer's stage
- Already-resolved requests cannot be reviewed
- Comment is optional for both approve and decline
