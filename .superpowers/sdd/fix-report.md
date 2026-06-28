# Fix Report: Approval Workflow Issues

## Status: Complete

## Changes Made

### Issue 1: Year-boundary balance bug (Important)

Changed all balance year derivations in `src/services/leave.service.ts` to use the leave request's `startDate` year instead of `new Date().getFullYear()`:

- `submitLeaveRequest`: `new Date().getFullYear()` -> `data.startDate.getFullYear()`
- `cancelLeaveRequest`: `new Date().getFullYear()` -> `request.startDate.getFullYear()`
- `reviewLeaveRequest` (approve-HR branch): `new Date().getFullYear()` -> `request.startDate.getFullYear()`
- `reviewLeaveRequest` (decline branch): `new Date().getFullYear()` -> `request.startDate.getFullYear()`

`getUserLeaveBalances` was left unchanged (correctly uses current year).

### Issue 2: Missing revalidation of employee's view (Minor)

Added `revalidatePath("/leaves")` to all four server action functions:

- `managerApproveAction` in `src/app/(dashboard)/manager/approvals/actions.ts`
- `managerDeclineAction` in `src/app/(dashboard)/manager/approvals/actions.ts`
- `hrApproveAction` in `src/app/(dashboard)/hr/approvals/actions.ts`
- `hrDeclineAction` in `src/app/(dashboard)/hr/approvals/actions.ts`

## Test Summary

- `npx tsc --noEmit --pretty`: Passed (no errors)
