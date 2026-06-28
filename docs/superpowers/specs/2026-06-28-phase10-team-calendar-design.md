# Phase 10: Team Calendar — Design Spec

**Date:** 2026-06-28
**Status:** Approved
**Master Plan:** `docs/superpowers/plans/2026-06-25-leave-management-system.md`

## Overview

A monthly team calendar showing who is on approved leave, accessible to all roles. Each day cell displays a count badge when people are on leave, with a hover tooltip listing names and leave types. HR gets a multi-select department filter; employees and managers see their own department.

## Decisions

- **Approach:** Custom CSS Grid calendar (no library). Full control over styling, zero new dependencies, consistent with Tailwind/shadcn.
- **Badge display:** Day cells show a count badge ("3 on leave") rather than individual names. Hover reveals the full list with leave type color-coding.
- **Month navigation:** Prev/next arrows plus a jump-to-month picker (two `<Select>` dropdowns for month name and year).
- **HR department filter:** Multi-select with checkboxes, allowing multiple departments to be viewed simultaneously. Defaults to all departments.
- **Employee access:** Employees get their own `/calendar` route in the sidebar (added to `commonItems`).

## Data Layer

### API Route

`GET /api/calendar`

**Query params:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `month` | number (1-12) | Yes | Target month |
| `year` | number | Yes | Target year |
| `departmentIds` | comma-separated UUIDs | No | HR only; filters departments |

**Authorization:**
- **Employee:** Returns approved leaves for the user's own department. `departmentIds` param ignored.
- **Manager:** Returns approved leaves for the manager's department. `departmentIds` param ignored.
- **HR:** Returns approved leaves for all departments by default, or filtered to selected `departmentIds`.

Returns `401` if unauthenticated.

### Service Function

`getCalendarLeaves(month: number, year: number, departmentIds?: string[]): Promise<CalendarLeave[]>`

Located in `src/services/calendar.service.ts`.

Queries `LeaveRequest` where:
- `status = APPROVED`
- The leave's date range overlaps the requested month (i.e., `startDate <= lastDayOfMonth AND endDate >= firstDayOfMonth`)

**Return type:**
```ts
type CalendarLeave = {
  id: string;
  userName: string;       // "firstName lastName"
  leaveTypeName: string;
  leaveTypeId: string;
  startDate: string;      // ISO date string
  endDate: string;        // ISO date string
  departmentName: string;
};
```

No per-day aggregation on the server — the client spreads multi-day leaves across calendar cells.

## Calendar Grid Component

Shared `TeamCalendar` client component used by all three pages.

### Grid Rendering

- 7-column CSS grid with day-of-week headers (Mon–Sun)
- Empty cells for offset days before the 1st of the month
- Each day cell shows the day number
- If anyone is on leave that day, a colored badge shows the count (e.g., "3 on leave")
- Days outside the current month are dimmed
- Today's date gets a subtle highlight ring

### Badge & Hover

- Badge uses a neutral/primary color (not per-type, since multiple types can overlap on one day)
- On hover, a shadcn `Tooltip` appears listing each person:
  - Name and leave type
  - Color-coded by leave type (deterministic palette based on `leaveTypeId`)

### Month Navigation

- Header row with left/right chevron buttons for prev/next month
- Between the arrows: two `<Select>` dropdowns (month name + year) for jump-to-month
- Changing the month triggers a client-side fetch to `/api/calendar` with updated `month`/`year`

### Props

```ts
type TeamCalendarProps = {
  initialLeaves: CalendarLeave[];
  initialMonth: number;
  initialYear: number;
  role: "EMPLOYEE" | "MANAGER" | "HR";
  departmentIds?: string[];       // HR only, for re-fetching
  departments?: { id: string; name: string }[];  // HR only, for filter UI
};
```

## Pages & Routing

### `/calendar` (Employee)

- Server component fetches approved leaves for the employee's department for the current month
- Passes `role="EMPLOYEE"` to `TeamCalendar` — no department filter
- Added to sidebar `commonItems` so all roles see it

### `/manager/calendar` (Manager)

- Server component fetches approved leaves for the manager's department
- Passes `role="MANAGER"` to `TeamCalendar` — no department filter
- Already wired in sidebar `managerItems`

### `/hr/calendar` (HR)

- Server component fetches all departments list + approved leaves (all departments by default)
- Passes `role="HR"` with `departments` list to `TeamCalendar`
- Renders a `DepartmentFilter` multi-select above the calendar grid
- Multi-select uses checkboxes in a dropdown; selecting/deselecting re-fetches data
- Already wired in sidebar `hrAdminItems`

### Authorization

Each page checks the session role server-side and redirects to `/dashboard` if unauthorized.

## File Structure

```
src/
  services/calendar.service.ts              # getCalendarLeaves()
  app/api/calendar/route.ts                 # GET handler
  app/(dashboard)/calendar/page.tsx         # Employee page
  app/(dashboard)/manager/calendar/page.tsx # Manager page
  app/(dashboard)/hr/calendar/page.tsx      # HR page
  components/calendar/team-calendar.tsx     # Shared calendar grid (client component)
  components/calendar/calendar-day.tsx      # Day cell with badge + tooltip
  components/calendar/month-picker.tsx      # Month/year navigation controls
  components/calendar/department-filter.tsx  # HR multi-select department filter
```

## Sidebar Changes

Add `{ label: "Team Calendar", href: "/calendar", icon: Calendar }` to `commonItems` in `app-sidebar.tsx`. This gives all roles (Employee, Manager, HR) a "my department" calendar link. Manager and HR also retain their role-specific calendar links (`/manager/calendar`, `/hr/calendar`), which serve the same data but are grouped under their role sections for discoverability. The `/calendar` page always shows the user's own department — the role-specific pages add manager/HR context (e.g., HR's department filter).

## Leave Type Color Palette

A deterministic color assignment based on `leaveTypeId` hash. A small palette of 8 distinct colors is defined in the calendar component. The color for a leave type is `palette[hash(leaveTypeId) % palette.length]`. This keeps colors consistent across sessions without needing to store color preferences.
