# Phase 4: HR — Leave Type Management — Design Spec

**Date:** 2026-06-27
**Status:** Approved
**Parent Spec:** `docs/superpowers/specs/2026-06-25-employee-leave-management-system-design.md`
**Master Plan Phase:** Phase 4

## Overview

HR users can create, edit, and activate/deactivate leave types from a dedicated management page. When a new leave type is created, leave balances are auto-created for all employees currently assigned to a department for the current calendar year.

## Approach

Server Actions for all mutations (no API routes). A service layer (`leave.service.ts`) encapsulates business logic. The page is a Server Component that fetches data directly via Prisma through the service layer. Interactive elements (table, dialogs) are Client Components.

## Service Layer

**File:** `src/services/leave.service.ts`

First service file in the project. All business logic for leave types and balance auto-creation lives here. Server Actions call these functions — they never touch Prisma directly.

### Functions

| Function | Purpose |
|----------|---------|
| `getAllLeaveTypes()` | Returns all leave types ordered by name |
| `createLeaveType(data)` | Creates leave type + auto-creates balances for all department-assigned users for the current year |
| `updateLeaveType(id, data)` | Updates name, description, defaultAllowance, isPaid on an existing leave type. Does **not** retroactively change existing users' `totalAllowance` in `LeaveBalance` — only affects future balance creation. |
| `toggleLeaveTypeActive(id)` | Flips `isActive` on/off |

### Balance Auto-Creation Logic (`createLeaveType`)

1. Create the leave type
2. Query all users where `departmentId IS NOT NULL`
3. Bulk-create `LeaveBalance` records (one per user) with `year = current year`, `totalAllowance = defaultAllowance`, `usedDays = 0`, `pendingDays = 0`
4. Both steps wrapped in a Prisma transaction

### Toggle Behavior

Toggling `isActive` does **not** delete existing balances. It only prevents the type from being selected in new leave requests (enforced in Phase 6 when the leave request form is built).

## Server Actions

**File:** `src/app/(dashboard)/hr/leave-types/actions.ts`

Thin `"use server"` functions that validate the session (must be HR role), validate input, and delegate to `leave.service.ts`. Each action returns `{ success: boolean; error?: string }`.

| Action | Input | Behavior |
|--------|-------|----------|
| `createLeaveTypeAction(formData)` | name, description, defaultAllowance, isPaid | Validates all fields, calls `createLeaveType()`, revalidates the page |
| `updateLeaveTypeAction(id, formData)` | id + same fields | Validates, calls `updateLeaveType()`, revalidates |
| `toggleLeaveTypeActiveAction(id)` | leave type id | Calls `toggleLeaveTypeActive()`, revalidates |

### Authorization

Every action calls `auth()` and checks `session.user.role === "HR"`. Returns `{ success: false, error: "Unauthorized" }` if not HR.

### Validation

Straightforward checks in the action — name required, defaultAllowance must be a positive integer. No Zod (consistent with Phase 2's pattern).

### Revalidation

Each action calls `revalidatePath("/hr/leave-types")` after a successful mutation so the Server Component re-fetches fresh data.

## Page

**File:** `src/app/(dashboard)/hr/leave-types/page.tsx` (Server Component)

Calls `auth()` to verify HR role (redirects to `/dashboard` if not HR). Calls `getAllLeaveTypes()` directly. Passes leave types data as props to the client table component.

## Components

### `src/components/leaves/leave-type-table.tsx` (Client Component)

Renders a table with columns:

| Column | Content |
|--------|---------|
| Name | Leave type name |
| Description | Leave type description |
| Allowance | Default allowance in days |
| Type | Paid / Unpaid |
| Status | Active (green badge) / Inactive (gray badge) |
| Actions | Edit button, Toggle button |

- "Create Leave Type" button at the top of the page opens the form dialog
- Each row's **Edit** button opens the form dialog pre-filled with that type's data
- Each row's **Toggle** button calls `toggleLeaveTypeActiveAction` directly (no confirmation dialog needed — the action is easily reversible)

### `src/components/leaves/leave-type-form-dialog.tsx` (Client Component)

shadcn `Dialog` wrapping a form. Used for both create and edit.

**Fields:**
- Name — text input (required)
- Description — textarea (optional)
- Default Allowance — number input (required, positive integer)
- Is Paid — checkbox (defaults to true)

**Behavior:**
- In create mode: empty fields, title "Create Leave Type", submit calls `createLeaveTypeAction`
- In edit mode: pre-populated fields, title "Edit Leave Type", submit calls `updateLeaveTypeAction`
- Shows inline error message if the action returns an error (e.g., duplicate name from unique constraint)
- Closes the dialog on success

## shadcn Components to Add

| Component | Command |
|-----------|---------|
| Table | `npx shadcn@latest add table` |
| Dialog | `npx shadcn@latest add dialog` |
| Checkbox | `npx shadcn@latest add checkbox` |
| Textarea | `npx shadcn@latest add textarea` |

## Files Summary

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/services/leave.service.ts` | Service | Leave type CRUD + balance auto-creation logic |
| `src/app/(dashboard)/hr/leave-types/page.tsx` | Server Component | Leave types management page |
| `src/app/(dashboard)/hr/leave-types/actions.ts` | Server Actions | Create, update, toggle leave type actions |
| `src/components/leaves/leave-type-table.tsx` | Client Component | Leave types table with action buttons |
| `src/components/leaves/leave-type-form-dialog.tsx` | Client Component | Create/edit leave type dialog form |

### No Modified Files

This phase does not modify any existing files.

### No Schema Changes

Uses existing `LeaveType` and `LeaveBalance` models from Phase 1.

## Test Plan

1. Login as the seeded HR user (`admin@company.com` / `admin123`)
2. Navigate to "Leave Types" in the sidebar → page loads showing the 4 seeded leave types in a table
3. Click "Create Leave Type" → dialog opens with empty fields
4. Fill in a new leave type (e.g., "Bereavement Leave", 5 days, paid) → submit → dialog closes, new type appears in table
5. Try creating a leave type with a duplicate name → inline error shown
6. Click Edit on an existing type → dialog opens with pre-filled values → change the description → submit → table updates
7. Click Toggle on an active type → status changes to Inactive (gray badge)
8. Click Toggle again → status changes back to Active (green badge)
9. Verify balance auto-creation: after creating a new leave type, check the database — `LeaveBalance` records should exist for all department-assigned users with the correct year and allowance
10. Login as a non-HR user → navigate to `/hr/leave-types` directly → redirected to `/dashboard`
