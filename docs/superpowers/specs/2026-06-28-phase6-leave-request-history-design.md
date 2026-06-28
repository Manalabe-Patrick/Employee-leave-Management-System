# Phase 6: Leave Request & History — Design Spec

**Date:** 2026-06-28
**Status:** Approved
**Depends on:** Phase 5 (Department & User Management)
**Approach:** Server Actions (consistent with Phases 4-5)

## Overview

Employees submit leave requests with balance validation, view their leave history with filters, and cancel pending requests. Leave balances track `pendingDays` on submit and decrement on cancel.

## Service Layer

All leave request logic lives in `src/services/leave.service.ts` (extending the existing file).

### `calculateBusinessDays(startDate: Date, endDate: Date): number`

Pure utility function. Counts weekdays (Monday–Friday) between start and end dates, inclusive. Returns 0 if end < start.

### `submitLeaveRequest(userId: string, data: { leaveTypeId, startDate, endDate, reason })`

Runs inside a Prisma transaction:

1. Verify user has a department assignment (reject if not)
2. Verify leave type exists and `isActive === true`
3. Calculate `totalDays` via `calculateBusinessDays`
4. Reject if `totalDays === 0` (e.g. weekend-only range)
5. Fetch user's `LeaveBalance` for this leave type and current year
6. Reject if `totalDays > totalAllowance - usedDays - pendingDays` (insufficient balance)
7. Check for overlapping dates: query existing requests for this user where status is not `CANCELLED` and date ranges overlap (`startDate <= existingEnd AND endDate >= existingStart`). Reject if any found.
8. Create `LeaveRequest` with status `PENDING_MANAGER`
9. Increment `pendingDays` on the user's `LeaveBalance` by `totalDays`
10. Return the created request

### `cancelLeaveRequest(userId: string, requestId: string)`

1. Fetch the request; reject if it doesn't belong to `userId`
2. Reject if status is not `PENDING_MANAGER` or `PENDING_HR`
3. Update status to `CANCELLED`
4. Decrement `pendingDays` on the user's `LeaveBalance` by `totalDays`

Both operations run in a transaction to prevent race conditions on balance updates.

### `getUserLeaveRequests(userId: string, filters?: { status?, leaveTypeId? })`

Fetches all leave requests for the user, ordered by `createdAt` desc. Includes the related `leaveType` (for displaying the type name). Applies optional `where` clauses for status and leaveTypeId filters.

### `getUserLeaveBalances(userId: string)`

Fetches all `LeaveBalance` records for the user for the current year, including the related `leaveType`. Only returns balances where `leaveType.isActive === true`. Used to populate the leave type dropdown in the request form and show remaining days.

## Server Actions

New file: `src/app/(dashboard)/leaves/actions.ts`

### `submitLeaveRequestAction(formData: FormData)`

1. Authenticate session via `auth()`; reject if not logged in
2. Extract fields: `leaveTypeId`, `startDate`, `endDate`, `reason`
3. Validate: all fields required, `reason` non-empty after trim, dates are valid, `endDate >= startDate`
4. Call `submitLeaveRequest(session.user.id, data)`
5. On success: `revalidatePath("/leaves")`, return `{ success: true }`
6. On failure: return `{ success: false, error: "<message>" }`

### `cancelLeaveRequestAction(requestId: string)`

1. Authenticate session via `auth()`; reject if not logged in
2. Call `cancelLeaveRequest(session.user.id, requestId)`
3. On success: `revalidatePath("/leaves")`, return `{ success: true }`
4. On failure: return `{ success: false, error: "<message>" }`

## Pages

### `/leaves/new` — Leave Request Form

**File:** `src/app/(dashboard)/leaves/new/page.tsx` (Server Component)

- Authenticates user, fetches leave balances via `getUserLeaveBalances`
- Renders `LeaveRequestForm` client component with balances as props

### `/leaves` — Leave History

**File:** `src/app/(dashboard)/leaves/page.tsx` (Server Component)

- Authenticates user, fetches leave requests via `getUserLeaveRequests` and active leave types for filter dropdown
- Renders `LeaveHistoryTable` client component with requests and leave types as props

## Components

### `LeaveRequestForm` (`src/components/leaves/leave-request-form.tsx`)

Client component. Props: `balances` (array of leave balances with leave type info).

- **Leave type dropdown** — Shows each active leave type with remaining days: `"Annual Leave (15 remaining)"`
- **Start date / End date** — Native date inputs
- **Calculated days display** — Shows business days between selected dates, updates on date change
- **Reason textarea** — Required
- **Client-side validation:**
  - End date >= start date
  - Reason not empty
  - Calculated days <= remaining balance for selected type
  - Shows inline error messages
- **Submit:** Calls `submitLeaveRequestAction`, redirects to `/leaves` on success, shows error on failure
- Uses existing shadcn components: `Select`, `Input`, `Textarea`, `Button`, `Card`, `Label`

### `LeaveHistoryTable` (`src/components/leaves/leave-history-table.tsx`)

Client component. Props: `requests` (array of leave requests with leave type), `leaveTypes` (for filter dropdown).

- **Filter bar:** Two `Select` dropdowns — status filter (All / Pending Manager / Pending HR / Approved / Declined / Cancelled) and leave type filter (All + each type). Filters applied client-side.
- **Table columns:** Leave Type | Start Date | End Date | Days | Status | Submitted | Actions
- **Status badges:** Color-coded using existing `Badge` component
  - `PENDING_MANAGER` / `PENDING_HR` → yellow/warning
  - `APPROVED` → green/success
  - `DECLINED` → red/destructive
  - `CANCELLED` → gray/secondary
- **Cancel action:** Button visible only on `PENDING_MANAGER` or `PENDING_HR` rows. Opens a confirmation dialog before calling `cancelLeaveRequestAction`.
- **Empty state:** Message when no requests match the current filters
- Uses existing shadcn components: `Table`, `Badge`, `Select`, `Button`, `Dialog`

## File Summary

| File | Type | Purpose |
|------|------|---------|
| `src/services/leave.service.ts` | Service (extend) | Add submit, cancel, query, balance functions |
| `src/app/(dashboard)/leaves/actions.ts` | Server Actions (new) | Submit and cancel leave actions |
| `src/app/(dashboard)/leaves/new/page.tsx` | Page (new) | Leave request form page |
| `src/app/(dashboard)/leaves/page.tsx` | Page (new) | Leave history page |
| `src/components/leaves/leave-request-form.tsx` | Component (new) | Leave request form |
| `src/components/leaves/leave-history-table.tsx` | Component (new) | Leave history table with filters |

## Validation Rules Summary

- User must be authenticated
- User must have a department assignment to submit leave
- Leave type must be active
- End date >= start date
- Total business days > 0
- Sufficient balance: `totalDays <= totalAllowance - usedDays - pendingDays`
- No overlapping dates with non-cancelled requests
- Can only cancel requests in `PENDING_MANAGER` or `PENDING_HR` status
- Can only cancel own requests
