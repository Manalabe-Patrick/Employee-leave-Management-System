# Phase 10: Team Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monthly team calendar showing who is on approved leave, accessible to all roles with role-appropriate scoping and an HR multi-select department filter.

**Architecture:** Custom CSS Grid calendar (no library) with a single shared `TeamCalendar` client component. A single API route (`GET /api/calendar`) serves all roles, scoped by session. Server pages fetch initial data; the client re-fetches on month/filter changes.

**Tech Stack:** Next.js App Router, Prisma, TypeScript, Tailwind CSS, shadcn/ui (Tooltip, Select, Checkbox, Button, DropdownMenu, Popover), Lucide icons.

## Global Constraints

- Follow existing patterns: thin API routes delegating to service functions, server component pages with client component interactivity.
- shadcn/ui components use `@base-ui/react` primitives (not Radix) — see `src/components/ui/select.tsx` and `src/components/ui/tooltip.tsx` for the pattern.
- Auth session shape: `session.user.userId`, `session.user.role`, `session.user.departmentId` (from `src/lib/auth.ts`).
- Dates in the database use `@db.Date` — timezone-naive date-only values.
- No new npm dependencies.

---

### Task 1: Calendar Service

**Files:**
- Create: `src/services/calendar.service.ts`

**Interfaces:**
- Consumes: Prisma client from `src/lib/db.ts`
- Produces: `CalendarLeave` type and `getCalendarLeaves(month: number, year: number, departmentIds?: string[]): Promise<CalendarLeave[]>`

- [ ] **Step 1: Create the service file with type and query**

```ts
// src/services/calendar.service.ts
import { db } from "@/lib/db";

export type CalendarLeave = {
  id: string;
  userName: string;
  leaveTypeName: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  departmentName: string;
};

export async function getCalendarLeaves(
  month: number,
  year: number,
  departmentIds?: string[]
): Promise<CalendarLeave[]> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const where: Record<string, unknown> = {
    status: "APPROVED",
    startDate: { lte: lastDay },
    endDate: { gte: firstDay },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const requests = await db.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return requests.map((r) => ({
    id: r.id,
    userName: `${r.user.firstName} ${r.user.lastName}`,
    leaveTypeName: r.leaveType.name,
    leaveTypeId: r.leaveType.id,
    startDate: r.startDate.toISOString().split("T")[0],
    endDate: r.endDate.toISOString().split("T")[0],
    departmentName: r.user.department?.name ?? "Unassigned",
  }));
}
```

- [ ] **Step 2: Verify the service compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `calendar.service.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/services/calendar.service.ts
git commit -m "feat(calendar): add calendar service with getCalendarLeaves query"
```

---

### Task 2: Calendar API Route

**Files:**
- Create: `src/app/api/calendar/route.ts`

**Interfaces:**
- Consumes: `getCalendarLeaves` from `src/services/calendar.service.ts`, `auth` from `src/lib/auth.ts`
- Produces: `GET /api/calendar?month=N&year=N&departmentIds=id1,id2` returning `CalendarLeave[]`

- [ ] **Step 1: Create the API route**

```ts
// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const month = parseInt(searchParams.get("month") ?? "", 10);
  const year = parseInt(searchParams.get("year") ?? "", 10);

  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
  }

  const { role, departmentId } = session.user;

  let departmentIds: string[] | undefined;

  if (role === "HR") {
    const rawIds = searchParams.get("departmentIds");
    if (rawIds) {
      departmentIds = rawIds.split(",").filter(Boolean);
    }
  } else {
    if (!departmentId) {
      return NextResponse.json([]);
    }
    departmentIds = [departmentId];
  }

  const leaves = await getCalendarLeaves(month, year, departmentIds);
  return NextResponse.json(leaves);
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `calendar/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/route.ts
git commit -m "feat(calendar): add GET /api/calendar route with role-based scoping"
```

---

### Task 3: Leave Type Color Palette

**Files:**
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `LEAVE_TYPE_COLORS: string[]` array and `getLeaveTypeColor(leaveTypeId: string): string` function

- [ ] **Step 1: Add the color palette and helper to constants**

Add to the end of `src/lib/constants.ts`:

```ts
export const LEAVE_TYPE_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

export const LEAVE_TYPE_DOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];

export function getLeaveTypeColorIndex(leaveTypeId: string): number {
  let hash = 0;
  for (let i = 0; i < leaveTypeId.length; i++) {
    hash = (hash * 31 + leaveTypeId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % LEAVE_TYPE_COLORS.length;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(calendar): add leave type color palette and hash function"
```

---

### Task 4: MonthPicker Component

**Files:**
- Create: `src/components/calendar/month-picker.tsx`

**Interfaces:**
- Consumes: shadcn `Select`, `Button` from `src/components/ui/`
- Produces: `MonthPicker` component with props `{ month: number; year: number; onChange: (month: number, year: number) => void }`

- [ ] **Step 1: Create the month picker component**

```tsx
// src/components/calendar/month-picker.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEAR_RANGE = 5;

type MonthPickerProps = {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
};

export function MonthPicker({ month, year, onChange }: MonthPickerProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: YEAR_RANGE * 2 + 1 },
    (_, i) => currentYear - YEAR_RANGE + i
  );

  function handlePrev() {
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  }

  function handleNext() {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePrev}>
        <ChevronLeft className="size-4" />
      </Button>

      <Select
        value={String(month)}
        onValueChange={(v) => onChange(Number(v), year)}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(year)}
        onValueChange={(v) => onChange(month, Number(v))}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={handleNext}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/month-picker.tsx
git commit -m "feat(calendar): add MonthPicker component with prev/next and jump-to-month"
```

---

### Task 5: CalendarDay Component

**Files:**
- Create: `src/components/calendar/calendar-day.tsx`

**Interfaces:**
- Consumes: `CalendarLeave` from `src/services/calendar.service.ts`, `Tooltip` from `src/components/ui/tooltip`, color helpers from `src/lib/constants.ts`
- Produces: `CalendarDay` component with props `{ day: number; isToday: boolean; isCurrentMonth: boolean; leaves: CalendarLeave[] }`

- [ ] **Step 1: Create the calendar day component**

```tsx
// src/components/calendar/calendar-day.tsx
"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LEAVE_TYPE_COLORS,
  LEAVE_TYPE_DOT_COLORS,
  getLeaveTypeColorIndex,
} from "@/lib/constants";
import type { CalendarLeave } from "@/services/calendar.service";

type CalendarDayProps = {
  day: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  leaves: CalendarLeave[];
};

export function CalendarDay({
  day,
  isToday,
  isCurrentMonth,
  leaves,
}: CalendarDayProps) {
  const hasLeaves = leaves.length > 0;

  const cellClasses = [
    "relative flex flex-col items-start p-1.5 min-h-[72px] border border-border/50 rounded-md text-sm",
    isCurrentMonth ? "" : "opacity-40",
    isToday ? "ring-2 ring-primary/50" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!hasLeaves) {
    return (
      <div className={cellClasses}>
        <span className="text-xs font-medium">{day}</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className={`${cellClasses} cursor-default hover:bg-muted/50`} />}
      >
        <span className="text-xs font-medium">{day}</span>
        <div className="mt-auto pt-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {leaves.length} off
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <ul className="space-y-1">
          {leaves.map((leave) => {
            const colorIdx = getLeaveTypeColorIndex(leave.leaveTypeId);
            return (
              <li key={leave.id} className="flex items-center gap-2 text-xs">
                <span
                  className={`size-2 shrink-0 rounded-full ${LEAVE_TYPE_DOT_COLORS[colorIdx]}`}
                />
                <span className="font-medium">{leave.userName}</span>
                <span className={`rounded px-1 py-0.5 text-[10px] ${LEAVE_TYPE_COLORS[colorIdx]}`}>
                  {leave.leaveTypeName}
                </span>
              </li>
            );
          })}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/calendar-day.tsx
git commit -m "feat(calendar): add CalendarDay component with badge and hover tooltip"
```

---

### Task 6: DepartmentFilter Component

**Files:**
- Create: `src/components/calendar/department-filter.tsx`

**Interfaces:**
- Consumes: `Checkbox` from `src/components/ui/checkbox`, `Button` and `DropdownMenu` from `src/components/ui/`
- Produces: `DepartmentFilter` component with props `{ departments: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }`

- [ ] **Step 1: Create the department filter component**

```tsx
// src/components/calendar/department-filter.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type DepartmentFilterProps = {
  departments: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function DepartmentFilter({
  departments,
  selected,
  onChange,
}: DepartmentFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allSelected = selected.length === departments.length;

  function handleToggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function handleToggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(departments.map((d) => d.id));
    }
  }

  const label =
    selected.length === 0
      ? "No departments"
      : allSelected
        ? "All departments"
        : `${selected.length} department${selected.length === 1 ? "" : "s"}`;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(!open)}
      >
        <Building2 className="size-4" />
        {label}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover p-1 shadow-md">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleToggleAll}
            />
            <span className="font-medium">All departments</span>
          </label>
          <div className="my-1 h-px bg-border" />
          {departments.map((dept) => (
            <label
              key={dept.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(dept.id)}
                onCheckedChange={() => handleToggle(dept.id)}
              />
              <span>{dept.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/department-filter.tsx
git commit -m "feat(calendar): add DepartmentFilter multi-select component"
```

---

### Task 7: TeamCalendar Component

**Files:**
- Create: `src/components/calendar/team-calendar.tsx`

**Interfaces:**
- Consumes: `CalendarLeave` from `src/services/calendar.service.ts`, `MonthPicker` from Task 4, `CalendarDay` from Task 5, `DepartmentFilter` from Task 6
- Produces: `TeamCalendar` component with props `TeamCalendarProps`

- [ ] **Step 1: Create the team calendar component**

```tsx
// src/components/calendar/team-calendar.tsx
"use client";

import { useState, useCallback } from "react";
import type { CalendarLeave } from "@/services/calendar.service";
import { MonthPicker } from "@/components/calendar/month-picker";
import { CalendarDay } from "@/components/calendar/calendar-day";
import { DepartmentFilter } from "@/components/calendar/department-filter";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type TeamCalendarProps = {
  initialLeaves: CalendarLeave[];
  initialMonth: number;
  initialYear: number;
  role: "EMPLOYEE" | "MANAGER" | "HR";
  departments?: { id: string; name: string }[];
  initialDepartmentIds?: string[];
};

function getLeavesForDay(
  leaves: CalendarLeave[],
  year: number,
  month: number,
  day: number
): CalendarLeave[] {
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return leaves.filter((l) => l.startDate <= dateStr && l.endDate >= dateStr);
}

export function TeamCalendar({
  initialLeaves,
  initialMonth,
  initialYear,
  role,
  departments,
  initialDepartmentIds,
}: TeamCalendarProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [leaves, setLeaves] = useState<CalendarLeave[]>(initialLeaves);
  const [loading, setLoading] = useState(false);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(
    initialDepartmentIds ?? []
  );

  const fetchLeaves = useCallback(
    async (m: number, y: number, deptIds?: string[]) => {
      setLoading(true);
      const params = new URLSearchParams({
        month: String(m),
        year: String(y),
      });
      if (role === "HR" && deptIds && deptIds.length > 0) {
        params.set("departmentIds", deptIds.join(","));
      }
      const res = await fetch(`/api/calendar?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeaves(data);
      }
      setLoading(false);
    },
    [role]
  );

  function handleMonthChange(newMonth: number, newYear: number) {
    setMonth(newMonth);
    setYear(newYear);
    fetchLeaves(newMonth, newYear, selectedDeptIds);
  }

  function handleDepartmentChange(ids: string[]) {
    setSelectedDeptIds(ids);
    fetchLeaves(month, year, ids);
  }

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDayOfWeek = firstDayOfMonth.getDay();
  // Convert Sunday=0 to Monday-based: Mon=0, Tue=1, ..., Sun=6
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const today = new Date();
  const todayDay =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? today.getDate()
      : -1;

  const cells: { day: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = offset - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true });
  }

  // Next month padding to fill final row
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, isCurrentMonth: false });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthPicker month={month} year={year} onChange={handleMonthChange} />
        {role === "HR" && departments && (
          <DepartmentFilter
            departments={departments}
            selected={selectedDeptIds}
            onChange={handleDepartmentChange}
          />
        )}
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        <div className="grid grid-cols-7 gap-px">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => (
            <CalendarDay
              key={i}
              day={cell.day}
              isToday={cell.isCurrentMonth && cell.day === todayDay}
              isCurrentMonth={cell.isCurrentMonth}
              leaves={
                cell.isCurrentMonth
                  ? getLeavesForDay(leaves, year, month, cell.day)
                  : []
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/team-calendar.tsx
git commit -m "feat(calendar): add TeamCalendar grid component with month nav and dept filter"
```

---

### Task 8: Calendar Pages + Sidebar Update

**Files:**
- Create: `src/app/(dashboard)/calendar/page.tsx`
- Create: `src/app/(dashboard)/manager/calendar/page.tsx`
- Create: `src/app/(dashboard)/hr/calendar/page.tsx`
- Modify: `src/components/layout/app-sidebar.tsx` (add Team Calendar to `commonItems`)

**Interfaces:**
- Consumes: `getCalendarLeaves` from `src/services/calendar.service.ts`, `getAllDepartments` from `src/services/department.service.ts`, `auth` from `src/lib/auth.ts`, `TeamCalendar` from Task 7
- Produces: Three routable pages and updated sidebar

- [ ] **Step 1: Create the employee calendar page**

```tsx
// src/app/(dashboard)/calendar/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";
import { TeamCalendar } from "@/components/calendar/team-calendar";

export default async function EmployeeCalendarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { departmentId, role } = session.user;

  if (!departmentId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Team Calendar</h1>
        <p className="text-sm text-muted-foreground">
          You must be assigned to a department to view the team calendar.
        </p>
      </div>
    );
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const leaves = await getCalendarLeaves(month, year, [departmentId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team Calendar</h1>
      <TeamCalendar
        initialLeaves={leaves}
        initialMonth={month}
        initialYear={year}
        role={role}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the manager calendar page**

```tsx
// src/app/(dashboard)/manager/calendar/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";
import { TeamCalendar } from "@/components/calendar/team-calendar";
import { db } from "@/lib/db";

export default async function ManagerCalendarPage() {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") redirect("/dashboard");

  const department = await db.department.findFirst({
    where: { managerId: session.user.userId },
    select: { id: true },
  });

  if (!department) redirect("/dashboard");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const leaves = await getCalendarLeaves(month, year, [department.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team Calendar</h1>
      <TeamCalendar
        initialLeaves={leaves}
        initialMonth={month}
        initialYear={year}
        role="MANAGER"
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the HR calendar page**

```tsx
// src/app/(dashboard)/hr/calendar/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";
import { getAllDepartments } from "@/services/department.service";
import { TeamCalendar } from "@/components/calendar/team-calendar";

export default async function HRCalendarPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [leaves, departments] = await Promise.all([
    getCalendarLeaves(month, year),
    getAllDepartments(),
  ]);

  const deptList = departments.map((d) => ({ id: d.id, name: d.name }));
  const allDeptIds = deptList.map((d) => d.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team Calendar</h1>
      <TeamCalendar
        initialLeaves={leaves}
        initialMonth={month}
        initialYear={year}
        role="HR"
        departments={deptList}
        initialDepartmentIds={allDeptIds}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add Team Calendar to commonItems in the sidebar**

In `src/components/layout/app-sidebar.tsx`, update the `commonItems` array:

Change from:
```ts
const commonItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Leaves", href: "/leaves", icon: CalendarDays },
];
```

To:
```ts
const commonItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Leaves", href: "/leaves", icon: CalendarDays },
  { label: "Team Calendar", href: "/calendar", icon: Calendar },
];
```

Note: `Calendar` is already imported from lucide-react in the file.

- [ ] **Step 5: Verify everything compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Manual test**

1. Start the dev server: `npm run dev`
2. Log in as an employee → sidebar shows "Team Calendar" → click it → calendar renders for current month with day grid
3. Log in as a manager → `/manager/calendar` shows department calendar; `/calendar` also works
4. Log in as HR → `/hr/calendar` shows all-departments calendar with department filter; selecting/deselecting departments re-fetches
5. Navigate months using prev/next arrows and jump-to-month dropdowns
6. If approved leaves exist, verify badge shows on the correct days with hover tooltip listing names + leave types
7. Verify today's date has a highlight ring
8. Verify dimmed appearance for days outside the current month

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/calendar/page.tsx src/app/(dashboard)/manager/calendar/page.tsx src/app/(dashboard)/hr/calendar/page.tsx src/components/layout/app-sidebar.tsx
git commit -m "feat(calendar): add employee, manager, HR calendar pages and sidebar link"
```

---
