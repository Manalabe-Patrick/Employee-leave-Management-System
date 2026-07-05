# Phase 8: Employee Dashboard — Design Spec

**Date:** 2026-06-28
**Status:** Approved
**Depends on:** Phase 7 (Approval Workflow)
**Approach:** Single Server Component page with parallel data fetching (Approach A)

## Overview

Replace the placeholder dashboard with a rich, role-aware page showing leave balance cards, recent leave requests, and actionable alert banners for managers and HR. All data is fetched server-side in a single parallel call. No client-side interactivity needed — the dashboard is read-only display.

## Service Layer

All new functions live in `src/services/leave.service.ts` (extending the existing file).

### `getRecentLeaveRequests(userId: string, limit: number)`

1. Query `LeaveRequest` where `userId` matches
2. Include `leaveType` (select `id`, `name`)
3. Order by `createdAt` descending
4. Take `limit` results (default: 5)
5. Return the array

### `getPendingManagerCount(managerId: string)`

1. Find the department where `managerId` matches
2. If no department found, return `0`
3. Count leave requests where `status === "PENDING_MANAGER"` and `user.departmentId === department.id`
4. Return the count

### `getPendingHRCount()`

1. Count leave requests where `status === "PENDING_HR"`
2. Return the count

### Existing function reused

`getUserLeaveBalances(userId)` — already returns current-year balances for active leave types with leave type names. No changes needed.

## Dashboard Page

**File:** `src/app/(dashboard)/dashboard/page.tsx` (replace existing placeholder)

Server Component. No client interactivity.

1. Authenticate via `auth()`; redirect to `/login` if not logged in
2. Fetch all data in parallel via `Promise.all`:
   - `getUserLeaveBalances(session.user.userId)`
   - `getRecentLeaveRequests(session.user.userId, 5)`
   - If role is `MANAGER`: `getPendingManagerCount(session.user.userId)`
   - If role is `HR`: `getPendingHRCount()`
3. Render sections in vertical order:
   - Welcome heading with user's first name (existing behavior preserved)
   - `DashboardAlerts` (manager/HR only, if count > 0)
   - `LeaveBalanceCards`
   - `RecentRequests`

## Components

### `LeaveBalanceCards` (`src/components/leaves/leave-balance-cards.tsx`)

Server Component (no interactivity).

**Props:**
- `balances` — array of objects: `{ totalAllowance: number, usedDays: number, pendingDays: number, leaveType: { id: string, name: string } }`

**Layout:**
- Responsive CSS grid: 1 column on mobile, 2 on `md`, 3 on `lg`
- Each card uses the existing `Card` component
- Card content: leave type name as title, remaining days prominently displayed (calculated as `totalAllowance - usedDays - pendingDays`), total allowance shown for context, subtle breakdown line showing used and pending days

**Edge case:**
- If `balances` array is empty, render a message: "No leave balances — contact HR to be assigned to a department"

### `RecentRequests` (`src/components/leaves/recent-requests.tsx`)

Server Component (no interactivity).

**Props:**
- `requests` — array of objects: `{ id: string, startDate: Date | string, endDate: Date | string, totalDays: number, status: string, createdAt: Date | string, leaveType: { id: string, name: string } }`

**Layout:**
- Header row: "Recent Requests" title on the left; "Request Leave" button (links to `/leaves/new`) and "View all" link (links to `/leaves`) on the right
- Compact table showing columns: Leave Type, Date Range, Days, Status
- Status column uses color-coded badges with the same style map as `leave-history-table.tsx`
- The `statusBadgeStyles` map is extracted to `src/lib/constants.ts` so both components share it

**Empty state:**
- "No leave requests yet" message

### `DashboardAlerts` (`src/components/layout/dashboard-alerts.tsx`)

Server Component (no interactivity).

**Props:**
- `role` — `"EMPLOYEE" | "MANAGER" | "HR"`
- `pendingManagerCount?` — number (only passed for MANAGER role)
- `pendingHRCount?` — number (only passed for HR role)

**Behavior:**
- Renders nothing if role is `EMPLOYEE` or all counts are `0`
- Manager banner: "You have N request(s) to review" — entire banner is a link to `/manager/approvals`
- HR banner: "You have N request(s) awaiting final approval" — entire banner is a link to `/hr/approvals`
- Styling: light background with left border accent (info-style alert card)

## Shared Constants Refactor

Extract `statusBadgeStyles` from `src/components/leaves/leave-history-table.tsx` into `src/lib/constants.ts`. Both `leave-history-table.tsx` and `recent-requests.tsx` import from there. The existing `roleBadgeClasses` in `constants.ts` stays as-is.

## File Summary

| File | Type | Purpose |
|------|------|---------|
| `src/services/leave.service.ts` | Service (extend) | Add `getRecentLeaveRequests`, `getPendingManagerCount`, `getPendingHRCount` |
| `src/app/(dashboard)/dashboard/page.tsx` | Page (replace) | Rich dashboard with parallel data fetching |
| `src/components/leaves/leave-balance-cards.tsx` | Component (new) | Leave balance card grid |
| `src/components/leaves/recent-requests.tsx` | Component (new) | Recent requests table with status badges |
| `src/components/layout/dashboard-alerts.tsx` | Component (new) | Clickable alert banners for managers/HR |
| `src/lib/constants.ts` | Constants (extend) | Add shared `statusBadgeStyles` map |
| `src/components/leaves/leave-history-table.tsx` | Component (modify) | Import `statusBadgeStyles` from constants instead of defining locally |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User has no department assignment | Balance cards show "No leave balances — contact HR" message |
| User has no leave requests | Recent requests show "No leave requests yet" message |
| Manager has 0 pending requests | No alert banner shown |
| HR has 0 pending requests | No alert banner shown |
| User has pending days | Balance cards show pending days in the breakdown |
