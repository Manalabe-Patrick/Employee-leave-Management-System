# Phase 11: Reports & CSV Export — Design Spec

**Date:** 2026-06-28
**Depends on:** Phase 7 (Approval Workflow), all prior phases complete
**Plan ref:** `docs/superpowers/plans/2026-06-25-leave-management-system.md`

---

## Overview

Add reporting dashboards for Manager (own department) and HR (all departments) with charts, a balance overview table, date range filtering, and server-side CSV export.

**Key decisions:**

- **Charting library:** Recharts (lightweight, React-native, declarative API)
- **CSV export:** Server-side via dedicated API route (not client-side generation)
- **Date range default:** Current year (Jan 1 – today)
- **Manager scope:** Own department only, no org-wide benchmarks
- **Architecture:** Server components with client chart islands; date range filter uses URL search params

---

## Data & Service Layer

New file: `src/services/report.service.ts`

Three query functions, all accepting date range and optional department scoping:

### `getUsageByDepartment(startDate, endDate, departmentIds?)`

- Queries `LeaveRequest` where `status = APPROVED` and request dates fall within the given range
- Groups results by department, sums `totalDays`
- Returns: `{ departmentName: string; totalDays: number }[]`

### `getUsageByType(startDate, endDate, departmentIds?)`

- Same base query as above, grouped by `LeaveType` instead of department
- Returns: `{ leaveTypeName: string; totalDays: number }[]`

### `getBalanceOverview(departmentIds?)`

- Queries `LeaveBalance` for the current year, joined with `User` and `LeaveType`
- Returns: `{ userName: string; leaveTypeName: string; totalAllowance: number; usedDays: number; pendingDays: number; remainingDays: number }[]`
- Powers both the balance table and the "balances" CSV export

All functions use Prisma `groupBy` or `findMany` with includes — no raw SQL.

---

## Pages & Routing

### `/manager/reports` — Server Component

- **Auth gate:** Role must be `MANAGER`, must have a `departmentId`
- **Search params:** `startDate`, `endDate` (defaults: Jan 1 current year – today)
- **Data scope:** Manager's own department only
- **Service calls:** All three functions, scoped to `[session.user.departmentId]`
- **Renders:** Date range filter → summary stats → bar chart (usage by leave type, since single department) + pie chart (usage by type) side by side → balance table full width

### `/hr/reports` — Server Component

- **Auth gate:** Role must be `HR`
- **Search params:** `startDate`, `endDate`, `departments` (comma-separated UUIDs, defaults to all)
- **Data scope:** All departments, or filtered subset
- **Service calls:** All three functions, scoped to selected departments (or all if none specified)
- **Renders:** Date range filter + department multi-select filter → summary stats → bar chart (usage by department) + pie chart (usage by type) side by side → balance table full width

### URL search params pattern

```
/hr/reports?startDate=2026-01-01&endDate=2026-06-28&departments=uuid1,uuid2
/manager/reports?startDate=2026-01-01&endDate=2026-06-28
```

Sidebar links already exist at these paths (defined in `app-sidebar.tsx`).

---

## Components

All report-specific components live in `src/components/reports/`.

### `report-filters.tsx` — Client Component

- Two `<input type="date">` fields for start and end date
- Optional department multi-select (rendered on HR page only, passed as a prop flag)
- "Apply" button: navigates to same page with updated search params
- "Reset" button: clears to defaults (current year, all departments)
- Receives current filter values as props from the server component

### `usage-by-department-chart.tsx` — Client Component

- Recharts `<BarChart>` with horizontal bars
- One bar per department, X-axis = total days, Y-axis = department names
- Tooltip shows exact day count on hover
- Props: `data: { departmentName: string; totalDays: number }[]`
- Used on HR page only (Manager page does not show this chart since they have a single department — they see the pie chart and a second bar chart via `usage-by-type-chart` instead)

### `usage-by-type-chart.tsx` — Client Component

- Supports two display modes via a `variant` prop: `"pie"` (default) and `"bar"`
- **Pie mode:** Recharts `<PieChart>` with `<Pie>`, legend showing type names and day counts, tooltip with percentage and day count
- **Bar mode:** Recharts `<BarChart>` with horizontal bars, one per leave type — used on the Manager page as the primary chart (since they have a single department and don't see the department bar chart)
- Props: `data: { leaveTypeName: string; totalDays: number }[]; variant?: "pie" | "bar"`
- Used on both Manager and HR pages

### `balance-table.tsx` — Server or Client Component

- shadcn `<Table>` with columns: Employee Name, Leave Type, Total Allowance, Used, Pending, Remaining
- Sorted by employee name, then leave type
- No pagination — dataset is bounded (employees × leave types per department)
- Props: `data: { userName: string; leaveTypeName: string; totalAllowance: number; usedDays: number; pendingDays: number; remainingDays: number }[]`

### `csv-export-button.tsx` — Client Component

- `<Button>` that fetches `/api/reports/export` with current filter params + a `type` param
- Receives CSV blob response, triggers browser download via object URL
- Shows loading spinner while request is in flight
- Props: `startDate: string; endDate: string; departments?: string; exportType: "usage-by-department" | "usage-by-type" | "balances"`

### Page Layout

```
┌─────────────────────────────────────────────────┐
│ Filters: [Start Date] [End Date] [Depts?] [Apply] [Reset] │
├─────────────────────────────────────────────────┤
│ Summary Stats: Total Days Used | Employees | Most-Used Type │
├────────────────────────┬────────────────────────┤
│ Bar Chart              │ Pie Chart              │
│ (by dept or by type)   │ (by type)              │
├────────────────────────┴────────────────────────┤
│ Balance Table                    [Export CSV ▼]  │
│ Name | Type | Allowance | Used | Pending | Rem  │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

The CSV export button appears near the balance table. Each chart section also has its own small export button for that specific dataset.

---

## CSV Export API Route

### `src/app/api/reports/export/route.ts` — GET

**Auth:** Validates session. Rejects unauthenticated requests (401). Rejects non-Manager/non-HR roles (403).

**Query params:**

| Param        | Required | Description                                      |
|-------------|----------|--------------------------------------------------|
| `startDate` | Yes      | ISO date string (YYYY-MM-DD)                     |
| `endDate`   | Yes      | ISO date string (YYYY-MM-DD)                     |
| `type`      | Yes      | `"usage-by-department"` \| `"usage-by-type"` \| `"balances"` |
| `departments` | No     | Comma-separated UUIDs (HR only)                  |

**Security:** Manager requests are hard-scoped to their `session.user.departmentId` regardless of the `departments` param. HR has no restriction.

**CSV shapes by type:**

- **`usage-by-department`**: `Department,Total Days Used`
- **`usage-by-type`**: `Leave Type,Total Days Used`
- **`balances`**: `Employee Name,Leave Type,Total Allowance,Used Days,Pending Days,Remaining Days`

**Response headers:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="report-{type}-{YYYY-MM-DD}.csv"
```

CSV string is built manually: header row + data rows, values escaped for embedded commas/quotes. No external CSV library needed — data is simple and tabular.

---

## Dependencies to Install

- `recharts` — charting library for bar and pie charts

No other new dependencies required. CSV generation is manual server-side string building.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/services/report.service.ts` | Three report query functions |
| `src/app/api/reports/export/route.ts` | CSV export GET endpoint |
| `src/app/(dashboard)/manager/reports/page.tsx` | Manager reports page |
| `src/app/(dashboard)/hr/reports/page.tsx` | HR reports page |
| `src/components/reports/report-filters.tsx` | Date range + department filter |
| `src/components/reports/usage-by-department-chart.tsx` | Bar chart component |
| `src/components/reports/usage-by-type-chart.tsx` | Pie chart component |
| `src/components/reports/balance-table.tsx` | Balance overview table |
| `src/components/reports/csv-export-button.tsx` | Download trigger button |

### No Modifications Needed

The sidebar already has links to `/manager/reports` and `/hr/reports` with the `BarChart3` icon. No changes to existing files are required.

---

## Testing Criteria

- As Manager: see only own department's data in all charts and tables
- As HR: see all departments; filter to specific departments; data updates accordingly
- Date range filter: changing dates and clicking Apply updates all charts and table
- Reset button: returns to current-year defaults
- Bar chart: displays correct department/type usage with tooltips
- Pie chart: displays correct type breakdown with legend and tooltips
- Balance table: shows correct remaining = totalAllowance - usedDays - pendingDays
- CSV export (all 3 types): downloads file with correct headers and data matching what's displayed
- CSV export security: Manager cannot export other departments' data
- Non-Manager/non-HR users redirected to dashboard
- Empty state: pages handle gracefully when no approved leaves exist in the date range
