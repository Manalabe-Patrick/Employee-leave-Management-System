# Phase 5: HR — Department & User Management — Design Spec

**Date:** 2026-06-27
**Status:** Approved
**Depends on:** Phase 4 (Leave Type Management)
**Master spec:** `docs/superpowers/specs/2026-06-25-employee-leave-management-system-design.md`

## Overview

HR can create, edit, and delete departments, assign managers to departments, manage users (role changes, department assignments). When a user is assigned to a department, leave balances are auto-created for all active leave types.

## Decisions

- **Department deletion:** Guard — only allowed when no employees are assigned.
- **Role promotion:** Linked — assigning a user as department manager auto-promotes them to MANAGER. Removing them demotes to EMPLOYEE (unless they're HR).
- **HR role:** HR users can promote others to the HR role directly.
- **Manager dropdown:** Shows all users. If the selected user already manages another department, a clear error is shown.
- **Architecture:** Server actions + service layer (same pattern as Phase 4). No API routes.

## Service Layer

### `src/services/department.service.ts`

- **`getAllDepartments()`** — returns all departments with manager (name, email) and employee count.
- **`createDepartment(name, description, managerId)`** — transaction: creates department, promotes user to MANAGER role, sets their `departmentId`.
- **`updateDepartment(id, name, description, managerId)`** — transaction: updates department. If manager changed: demotes old manager to EMPLOYEE (unless HR) but keeps their `departmentId` unchanged (they remain in the department as an employee), promotes new manager to MANAGER, sets new manager's `departmentId` to this department.
- **`deleteDepartment(id)`** — guard: rejects if employees are assigned. Deletes department, demotes manager to EMPLOYEE (unless HR).

### `src/services/user.service.ts`

- **`getAllUsers()`** — returns all users with department name.
- **`updateUserDepartment(userId, departmentId)`** — transaction: updates `departmentId`, auto-creates leave balances for all active leave types for current year (uses `createMany` with `skipDuplicates: true`).
- **`updateUserRole(userId, role)`** — sets role to HR or EMPLOYEE directly. MANAGER role is only set via department manager assignment.
- **`unassignUserDepartment(userId)`** — sets `departmentId` to null.

## Server Actions

### `src/app/(dashboard)/hr/departments/actions.ts`

- **`createDepartmentAction(formData)`** — validates name (required, trimmed) and managerId (required). Handles P2002 for duplicate department name and unique `managerId` constraint. Revalidates `/hr/departments`.
- **`updateDepartmentAction(id, formData)`** — same validation and error handling as create.
- **`deleteDepartmentAction(id)`** — returns error if employees are assigned. Revalidates `/hr/departments`.

All actions: `requireHR()` auth check, return `{ success, error? }`, catch Prisma errors by code.

### `src/app/(dashboard)/hr/users/actions.ts`

- **`updateUserDepartmentAction(userId, departmentId | null)`** — assigns or unassigns department. Revalidates `/hr/users`.
- **`updateUserRoleAction(userId, role)`** — validates role is HR or EMPLOYEE (not MANAGER). Revalidates `/hr/users`.

All actions: `requireHR()` auth check, return `{ success, error? }`, catch Prisma errors by code.

## UI Components & Pages

### `/hr/departments` Page

Server component fetches all departments and all users (for manager dropdown).

**`DepartmentTable`** (`src/components/departments/department-table.tsx`):
- Columns: Name, Description, Manager (name + email), Employee Count, Actions (Edit, Delete).
- Delete button disabled with tooltip if department has employees.

**`DepartmentFormDialog`** (`src/components/departments/department-form-dialog.tsx`):
- Shadcn dialog for create/edit.
- Fields: Name (input), Description (textarea), Manager (select dropdown of all users).
- Inline validation errors. Used for both create and edit modes.

### `/hr/users` Page

Server component fetches all users and all departments (for department dropdown).

**`UserTable`** (`src/components/users/user-table.tsx`):
- Columns: Name, Email, Role (color-coded badge), Department, Actions (Edit).

**`UserEditDialog`** (`src/components/users/user-edit-dialog.tsx`):
- Shadcn dialog for editing a user.
- Shows user name and email as read-only context at top.
- Fields: Department (select dropdown with "Unassigned" option), Role (select with HR/EMPLOYEE options). If the user currently has MANAGER role, the role field shows "MANAGER" as a read-only indicator with a note: "Set via department assignment" — it cannot be changed directly.

### Shared Patterns (from Phase 4)

- `useTransition` for form submissions with loading states.
- Dialog closes on success, stays open with error on failure.
- Tables use shadcn `<Table>` component.

## Leave Balance Auto-Creation

When HR assigns a user to a department:

1. Query all active leave types.
2. `createMany` with `skipDuplicates: true` — one `LeaveBalance` per active leave type for the current year, with `totalAllowance` from `defaultAllowance`.
3. If the user was previously in a department and already has balances, duplicates are silently skipped.

**No cleanup on unassignment** — balances are preserved to avoid losing historical pending/used day counts.

## Session Refresh

When HR changes a user's role or department, the affected user's JWT still contains old `role`/`departmentId` until they re-login. This is a known limitation of JWT strategy and is acceptable — the user logs out and back in to see updated navigation. Not addressed in Phase 5.

## Files

| File | Purpose |
|------|---------|
| `src/services/department.service.ts` | Department CRUD + manager role logic |
| `src/services/user.service.ts` | User management + balance auto-creation |
| `src/app/(dashboard)/hr/departments/page.tsx` | Departments list page (server component) |
| `src/app/(dashboard)/hr/departments/actions.ts` | Department server actions |
| `src/components/departments/department-table.tsx` | Department table with actions |
| `src/components/departments/department-form-dialog.tsx` | Create/edit department dialog |
| `src/app/(dashboard)/hr/users/page.tsx` | Users list page (server component) |
| `src/app/(dashboard)/hr/users/actions.ts` | User server actions |
| `src/components/users/user-table.tsx` | User table with actions |
| `src/components/users/user-edit-dialog.tsx` | Edit user dialog |

## Test Plan

1. As HR, create "Engineering" department with a manager → manager is auto-promoted to MANAGER role.
2. Edit department to change manager → old manager demoted, new manager promoted.
3. Try to delete department with employees → blocked with error.
4. Remove all employees, then delete → succeeds, manager demoted.
5. On users page, assign an employee to a department → leave balances created for all active leave types.
6. Unassign employee → `departmentId` set to null, balances preserved.
7. Promote a user to HR role → role updates.
8. Try to assign a user who already manages a department as manager of another → clear error shown.
9. Affected user logs out and back in → sees updated role/navigation.
