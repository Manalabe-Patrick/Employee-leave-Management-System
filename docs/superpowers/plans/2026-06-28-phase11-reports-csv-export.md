# Phase 11: Reports & CSV Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reporting dashboards for Manager (own department) and HR (all departments) with bar/pie charts via Recharts, a balance overview table, date range filtering via URL search params, and server-side CSV export.

**Architecture:** Server components fetch report data directly via service functions. Charts are `"use client"` islands receiving pre-fetched data as props. Date range and department filters update URL search params, triggering a server re-render. CSV export hits a dedicated API route that streams the file.

**Tech Stack:** Next.js 16 (App Router), Prisma, Recharts, shadcn/ui, TypeScript

## Global Constraints

- Next.js 16 — read `node_modules/next/dist/docs/` for any API changes before writing page/route code
- Recharts 2.x — install as dependency
- No raw SQL — use Prisma `groupBy` and `findMany` with includes
- No external CSV library — build CSV strings manually
- Follow existing patterns: `auth()` for session, `redirect()` for auth gates, `db` singleton from `@/lib/db`
- Sidebar links to `/manager/reports` and `/hr/reports` already exist — no sidebar changes needed

---

### Task 1: Install Recharts & Verify Build

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `recharts` available as an import for Tasks 4 and 5

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Verify the build still compiles**

```bash
npm run build
```

Expected: Build succeeds with no errors. If the build was already broken before this task, only verify that `recharts` appears in `package.json` dependencies and that `import { BarChart } from "recharts"` resolves (create a throwaway file and delete it).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install recharts for report charts"
```

---

### Task 2: Report Service Layer

**Files:**
- Create: `src/services/report.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`, Prisma schema models `LeaveRequest`, `LeaveBalance`, `User`, `Department`, `LeaveType`
- Produces:
  - `getUsageByDepartment(startDate: Date, endDate: Date, departmentIds?: string[]): Promise<{ departmentName: string; totalDays: number }[]>`
  - `getUsageByType(startDate: Date, endDate: Date, departmentIds?: string[]): Promise<{ leaveTypeName: string; totalDays: number }[]>`
  - `getBalanceOverview(departmentIds?: string[]): Promise<{ userName: string; leaveTypeName: string; totalAllowance: number; usedDays: number; pendingDays: number; remainingDays: number }[]>`

- [ ] **Step 1: Create report.service.ts with getUsageByDepartment**

Create `src/services/report.service.ts`:

```typescript
import { db } from "@/lib/db";

export async function getUsageByDepartment(
  startDate: Date,
  endDate: Date,
  departmentIds?: string[]
): Promise<{ departmentName: string; totalDays: number }[]> {
  const where: Record<string, unknown> = {
    status: "APPROVED",
    startDate: { lte: endDate },
    endDate: { gte: startDate },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const requests = await db.leaveRequest.findMany({
    where,
    select: {
      totalDays: true,
      user: {
        select: {
          department: { select: { name: true } },
        },
      },
    },
  });

  const byDept = new Map<string, number>();
  for (const r of requests) {
    const name = r.user.department?.name ?? "Unassigned";
    byDept.set(name, (byDept.get(name) ?? 0) + r.totalDays);
  }

  return Array.from(byDept.entries())
    .map(([departmentName, totalDays]) => ({ departmentName, totalDays }))
    .sort((a, b) => b.totalDays - a.totalDays);
}
```

- [ ] **Step 2: Add getUsageByType**

Append to `src/services/report.service.ts`:

```typescript
export async function getUsageByType(
  startDate: Date,
  endDate: Date,
  departmentIds?: string[]
): Promise<{ leaveTypeName: string; totalDays: number }[]> {
  const where: Record<string, unknown> = {
    status: "APPROVED",
    startDate: { lte: endDate },
    endDate: { gte: startDate },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const requests = await db.leaveRequest.findMany({
    where,
    select: {
      totalDays: true,
      leaveType: { select: { name: true } },
    },
  });

  const byType = new Map<string, number>();
  for (const r of requests) {
    const name = r.leaveType.name;
    byType.set(name, (byType.get(name) ?? 0) + r.totalDays);
  }

  return Array.from(byType.entries())
    .map(([leaveTypeName, totalDays]) => ({ leaveTypeName, totalDays }))
    .sort((a, b) => b.totalDays - a.totalDays);
}
```

- [ ] **Step 3: Add getBalanceOverview**

Append to `src/services/report.service.ts`:

```typescript
export async function getBalanceOverview(
  departmentIds?: string[]
): Promise<{
  userName: string;
  leaveTypeName: string;
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}[]> {
  const currentYear = new Date().getFullYear();

  const where: Record<string, unknown> = {
    year: currentYear,
    leaveType: { isActive: true },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const balances = await db.leaveBalance.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      leaveType: { select: { name: true } },
    },
    orderBy: [
      { user: { firstName: "asc" } },
      { leaveType: { name: "asc" } },
    ],
  });

  return balances.map((b) => ({
    userName: `${b.user.firstName} ${b.user.lastName}`,
    leaveTypeName: b.leaveType.name,
    totalAllowance: b.totalAllowance,
    usedDays: b.usedDays,
    pendingDays: b.pendingDays,
    remainingDays: b.totalAllowance - b.usedDays - b.pendingDays,
  }));
}
```

- [ ] **Step 4: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/report.service.ts
git commit -m "feat(reports): add report service with usage and balance queries"
```

---

### Task 3: Report Filters Component

**Files:**
- Create: `src/components/reports/report-filters.tsx`

**Interfaces:**
- Consumes: shadcn `Button` from `@/components/ui/button`, `Input` from `@/components/ui/input`, `DepartmentFilter` from `@/components/calendar/department-filter`, Next.js `useRouter` and `usePathname`
- Produces: `ReportFilters` component with props:
  ```typescript
  type ReportFiltersProps = {
    startDate: string;       // YYYY-MM-DD
    endDate: string;         // YYYY-MM-DD
    showDepartments?: boolean;
    departments?: { id: string; name: string }[];
    selectedDepartmentIds?: string[];
  }
  ```

- [ ] **Step 1: Create report-filters.tsx**

Create `src/components/reports/report-filters.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DepartmentFilter } from "@/components/calendar/department-filter";
import { RotateCcw, Search } from "lucide-react";

type ReportFiltersProps = {
  startDate: string;
  endDate: string;
  showDepartments?: boolean;
  departments?: { id: string; name: string }[];
  selectedDepartmentIds?: string[];
};

export function ReportFilters({
  startDate,
  endDate,
  showDepartments,
  departments,
  selectedDepartmentIds,
}: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [deptIds, setDeptIds] = useState<string[]>(selectedDepartmentIds ?? []);

  function handleApply() {
    const params = new URLSearchParams();
    params.set("startDate", start);
    params.set("endDate", end);
    if (showDepartments && deptIds.length > 0) {
      params.set("departments", deptIds.join(","));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleReset() {
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const today = now.toISOString().split("T")[0];
    setStart(yearStart);
    setEnd(today);
    if (departments) {
      setDeptIds(departments.map((d) => d.id));
    }
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="endDate">End Date</Label>
        <Input
          id="endDate"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-40"
        />
      </div>
      {showDepartments && departments && (
        <div className="space-y-1">
          <Label>Departments</Label>
          <DepartmentFilter
            departments={departments}
            selected={deptIds}
            onChange={setDeptIds}
          />
        </div>
      )}
      <Button onClick={handleApply} size="sm" className="gap-2">
        <Search className="size-4" />
        Apply
      </Button>
      <Button onClick={handleReset} variant="outline" size="sm" className="gap-2">
        <RotateCcw className="size-4" />
        Reset
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/report-filters.tsx
git commit -m "feat(reports): add ReportFilters component with date range and department filter"
```

---

### Task 4: Chart Components (Bar + Pie)

**Files:**
- Create: `src/components/reports/usage-by-department-chart.tsx`
- Create: `src/components/reports/usage-by-type-chart.tsx`

**Interfaces:**
- Consumes: `recharts` (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `PieChart`, `Pie`, `Cell`, `Legend`)
- Produces:
  - `UsageByDepartmentChart` with props: `{ data: { departmentName: string; totalDays: number }[] }`
  - `UsageByTypeChart` with props: `{ data: { leaveTypeName: string; totalDays: number }[]; variant?: "pie" | "bar" }`

- [ ] **Step 1: Create usage-by-department-chart.tsx**

Create `src/components/reports/usage-by-department-chart.tsx`:

```typescript
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UsageByDepartmentChartProps = {
  data: { departmentName: string; totalDays: number }[];
};

export function UsageByDepartmentChart({ data }: UsageByDepartmentChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Department</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No approved leaves in this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Department</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={data.length * 50 + 40}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="departmentName" width={120} />
            <Tooltip formatter={(value: number) => [`${value} days`, "Total"]} />
            <Bar dataKey="totalDays" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create usage-by-type-chart.tsx**

Create `src/components/reports/usage-by-type-chart.tsx`:

```typescript
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

type UsageByTypeChartProps = {
  data: { leaveTypeName: string; totalDays: number }[];
  variant?: "pie" | "bar";
};

export function UsageByTypeChart({ data, variant = "pie" }: UsageByTypeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Leave Type</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No approved leaves in this period.</p>
        </CardContent>
      </Card>
    );
  }

  if (variant === "bar") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Leave Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={data.length * 50 + 40}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="leaveTypeName" width={120} />
              <Tooltip formatter={(value: number) => [`${value} days`, "Total"]} />
              <Bar dataKey="totalDays" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.totalDays, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Leave Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="totalDays"
              nameKey="leaveTypeName"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ leaveTypeName, totalDays }) =>
                `${leaveTypeName}: ${totalDays}d`
              }
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} days (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                name,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/usage-by-department-chart.tsx src/components/reports/usage-by-type-chart.tsx
git commit -m "feat(reports): add bar and pie chart components using Recharts"
```

---

### Task 5: Balance Table & CSV Export Button

**Files:**
- Create: `src/components/reports/balance-table.tsx`
- Create: `src/components/reports/csv-export-button.tsx`

**Interfaces:**
- Consumes: shadcn `Table`, `Button` components
- Produces:
  - `BalanceTable` with props: `{ data: { userName: string; leaveTypeName: string; totalAllowance: number; usedDays: number; pendingDays: number; remainingDays: number }[] }`
  - `CsvExportButton` with props: `{ startDate: string; endDate: string; departments?: string; exportType: "usage-by-department" | "usage-by-type" | "balances" }`

- [ ] **Step 1: Create balance-table.tsx**

Create `src/components/reports/balance-table.tsx`:

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BalanceRow = {
  userName: string;
  leaveTypeName: string;
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
};

type BalanceTableProps = {
  data: BalanceRow[];
};

export function BalanceTable({ data }: BalanceTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No balance data available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Leave Type</TableHead>
            <TableHead className="text-right">Allowance</TableHead>
            <TableHead className="text-right">Used</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{row.userName}</TableCell>
              <TableCell>{row.leaveTypeName}</TableCell>
              <TableCell className="text-right">{row.totalAllowance}</TableCell>
              <TableCell className="text-right">{row.usedDays}</TableCell>
              <TableCell className="text-right">{row.pendingDays}</TableCell>
              <TableCell className="text-right">{row.remainingDays}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Create csv-export-button.tsx**

Create `src/components/reports/csv-export-button.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

type CsvExportButtonProps = {
  startDate: string;
  endDate: string;
  departments?: string;
  exportType: "usage-by-department" | "usage-by-type" | "balances";
};

export function CsvExportButton({
  startDate,
  endDate,
  departments,
  exportType,
}: CsvExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        type: exportType,
      });
      if (departments) {
        params.set("departments", departments);
      }
      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) {
        throw new Error("Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ??
        `report-${exportType}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-2"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      Export CSV
    </Button>
  );
}
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/balance-table.tsx src/components/reports/csv-export-button.tsx
git commit -m "feat(reports): add BalanceTable and CsvExportButton components"
```

---

### Task 6: CSV Export API Route

**Files:**
- Create: `src/app/api/reports/export/route.ts`

**Interfaces:**
- Consumes: `auth()` from `@/lib/auth`, `getUsageByDepartment`, `getUsageByType`, `getBalanceOverview` from `@/services/report.service`
- Produces: GET endpoint returning `text/csv` response with `Content-Disposition: attachment` header

- [ ] **Step 1: Read Next.js route handler docs**

Before writing the route, check for any API changes in Next.js 16:

```bash
cat node_modules/next/dist/docs/04-api-reference/01-directives/use-cache.md | head -20
```

Also review the existing API route pattern in `src/app/api/calendar/route.ts` (already read — uses `NextRequest`, `NextResponse`, `auth()`, `request.nextUrl.searchParams`).

- [ ] **Step 2: Create the CSV export route**

Create `src/app/api/reports/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUsageByDepartment,
  getUsageByType,
  getBalanceOverview,
} from "@/services/report.service";

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, departmentId } = session.user;
  if (role !== "MANAGER" && role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const startDateStr = params.get("startDate");
  const endDateStr = params.get("endDate");
  const type = params.get("type");

  if (!startDateStr || !endDateStr || !type) {
    return NextResponse.json(
      { error: "Missing required params: startDate, endDate, type" },
      { status: 400 }
    );
  }

  const validTypes = ["usage-by-department", "usage-by-type", "balances"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  let departmentIds: string[] | undefined;
  if (role === "MANAGER") {
    if (!departmentId) {
      return NextResponse.json({ error: "Manager has no department" }, { status: 400 });
    }
    departmentIds = [departmentId];
  } else {
    const rawDepts = params.get("departments");
    if (rawDepts) {
      departmentIds = rawDepts.split(",").filter(Boolean);
    }
  }

  let csv: string;

  if (type === "usage-by-department") {
    const data = await getUsageByDepartment(startDate, endDate, departmentIds);
    csv = toCsv(
      ["Department", "Total Days Used"],
      data.map((d) => [d.departmentName, d.totalDays])
    );
  } else if (type === "usage-by-type") {
    const data = await getUsageByType(startDate, endDate, departmentIds);
    csv = toCsv(
      ["Leave Type", "Total Days Used"],
      data.map((d) => [d.leaveTypeName, d.totalDays])
    );
  } else {
    const data = await getBalanceOverview(departmentIds);
    csv = toCsv(
      ["Employee Name", "Leave Type", "Total Allowance", "Used Days", "Pending Days", "Remaining Days"],
      data.map((d) => [
        d.userName,
        d.leaveTypeName,
        d.totalAllowance,
        d.usedDays,
        d.pendingDays,
        d.remainingDays,
      ])
    );
  }

  const today = new Date().toISOString().split("T")[0];
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="report-${type}-${today}.csv"`,
    },
  });
}
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reports/export/route.ts
git commit -m "feat(reports): add CSV export API route with auth and role scoping"
```

---

### Task 7: Manager Reports Page

**Files:**
- Create: `src/app/(dashboard)/manager/reports/page.tsx`

**Interfaces:**
- Consumes: `auth()` from `@/lib/auth`, `getUsageByType`, `getBalanceOverview` from `@/services/report.service`, all report components from Tasks 3–5
- Produces: `/manager/reports` page rendering filters, charts, table, and export buttons

- [ ] **Step 1: Read Next.js page docs for searchParams handling**

Next.js 16 may have changed how `searchParams` are passed to pages. Check:

```bash
ls node_modules/next/dist/docs/
```

Look for docs on page props and `searchParams`. In Next.js 15+, `searchParams` is a Promise. Verify the pattern.

- [ ] **Step 2: Create the manager reports page**

Create `src/app/(dashboard)/manager/reports/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUsageByType, getBalanceOverview } from "@/services/report.service";
import { ReportFilters } from "@/components/reports/report-filters";
import { UsageByTypeChart } from "@/components/reports/usage-by-type-chart";
import { BalanceTable } from "@/components/reports/balance-table";
import { CsvExportButton } from "@/components/reports/csv-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") redirect("/dashboard");

  const { departmentId } = session.user;
  if (!departmentId) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const startDate = params.startDate ?? `${now.getFullYear()}-01-01`;
  const endDate = params.endDate ?? now.toISOString().split("T")[0];

  const departmentIds = [departmentId];

  const [usageByType, balances] = await Promise.all([
    getUsageByType(new Date(startDate), new Date(endDate), departmentIds),
    getBalanceOverview(departmentIds),
  ]);

  const totalDaysUsed = usageByType.reduce((sum, d) => sum + d.totalDays, 0);
  const uniqueEmployees = new Set(balances.map((b) => b.userName)).size;
  const mostUsedType = usageByType[0]?.leaveTypeName ?? "—";

  const deptParam = departmentIds.join(",");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Department Reports</h1>

      <ReportFilters startDate={startDate} endDate={endDate} />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Days Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDaysUsed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{uniqueEmployees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Used Type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{mostUsedType}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <UsageByTypeChart data={usageByType} variant="bar" />
        <UsageByTypeChart data={usageByType} variant="pie" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Balance Overview</h2>
          <div className="flex gap-2">
            <CsvExportButton
              startDate={startDate}
              endDate={endDate}
              departments={deptParam}
              exportType="usage-by-type"
            />
            <CsvExportButton
              startDate={startDate}
              endDate={endDate}
              departments={deptParam}
              exportType="balances"
            />
          </div>
        </div>
        <BalanceTable data={balances} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Manually test in browser**

Start the dev server (`npm run dev`), log in as a Manager, navigate to `/manager/reports`.

Verify:
- Page loads with current-year date range
- Summary stat cards show correct numbers
- Bar chart shows usage by leave type
- Pie chart shows usage by leave type with legend
- Balance table shows department employees
- Date range filter works (change dates → Apply → data updates)
- Reset button returns to defaults
- CSV export downloads a file with correct data
- Empty state renders gracefully if no approved leaves exist

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/manager/reports/page.tsx
git commit -m "feat(reports): add manager reports page with charts and filters"
```

---

### Task 8: HR Reports Page

**Files:**
- Create: `src/app/(dashboard)/hr/reports/page.tsx`

**Interfaces:**
- Consumes: `auth()` from `@/lib/auth`, `getUsageByDepartment`, `getUsageByType`, `getBalanceOverview` from `@/services/report.service`, `getAllDepartments` from `@/services/department.service`, all report components from Tasks 3–5
- Produces: `/hr/reports` page rendering filters (with department multi-select), charts, table, and export buttons

- [ ] **Step 1: Create the HR reports page**

Create `src/app/(dashboard)/hr/reports/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getUsageByDepartment,
  getUsageByType,
  getBalanceOverview,
} from "@/services/report.service";
import { getAllDepartments } from "@/services/department.service";
import { ReportFilters } from "@/components/reports/report-filters";
import { UsageByDepartmentChart } from "@/components/reports/usage-by-department-chart";
import { UsageByTypeChart } from "@/components/reports/usage-by-type-chart";
import { BalanceTable } from "@/components/reports/balance-table";
import { CsvExportButton } from "@/components/reports/csv-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HRReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    departments?: string;
  }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const startDate = params.startDate ?? `${now.getFullYear()}-01-01`;
  const endDate = params.endDate ?? now.toISOString().split("T")[0];

  const allDepartments = await getAllDepartments();
  const deptList = allDepartments.map((d) => ({ id: d.id, name: d.name }));
  const allDeptIds = deptList.map((d) => d.id);

  const selectedDeptIds = params.departments
    ? params.departments.split(",").filter(Boolean)
    : allDeptIds;

  const departmentIds = selectedDeptIds.length > 0 ? selectedDeptIds : undefined;

  const [usageByDept, usageByType, balances] = await Promise.all([
    getUsageByDepartment(new Date(startDate), new Date(endDate), departmentIds),
    getUsageByType(new Date(startDate), new Date(endDate), departmentIds),
    getBalanceOverview(departmentIds),
  ]);

  const totalDaysUsed = usageByType.reduce((sum, d) => sum + d.totalDays, 0);
  const uniqueEmployees = new Set(balances.map((b) => b.userName)).size;
  const mostUsedType = usageByType[0]?.leaveTypeName ?? "—";

  const deptParam = selectedDeptIds.join(",");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Organization Reports</h1>

      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        showDepartments
        departments={deptList}
        selectedDepartmentIds={selectedDeptIds}
      />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Days Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDaysUsed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{uniqueEmployees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Used Type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{mostUsedType}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <UsageByDepartmentChart data={usageByDept} />
        <UsageByTypeChart data={usageByType} variant="pie" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Balance Overview</h2>
          <div className="flex gap-2">
            <CsvExportButton
              startDate={startDate}
              endDate={endDate}
              departments={deptParam}
              exportType="usage-by-department"
            />
            <CsvExportButton
              startDate={startDate}
              endDate={endDate}
              departments={deptParam}
              exportType="usage-by-type"
            />
            <CsvExportButton
              startDate={startDate}
              endDate={endDate}
              departments={deptParam}
              exportType="balances"
            />
          </div>
        </div>
        <BalanceTable data={balances} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Manually test in browser**

Start the dev server (`npm run dev`), log in as HR, navigate to `/hr/reports`.

Verify:
- Page loads with current-year date range and all departments selected
- Summary stat cards show correct org-wide numbers
- Bar chart shows usage by department
- Pie chart shows usage by leave type with legend
- Balance table shows all employees across departments
- Department filter: deselect some → Apply → data updates to show only selected departments
- Date range filter: change dates → Apply → data updates
- Reset button: returns to current year + all departments
- CSV export: all 3 buttons download correct files
  - `usage-by-department` CSV: columns "Department,Total Days Used"
  - `usage-by-type` CSV: columns "Leave Type,Total Days Used"
  - `balances` CSV: columns "Employee Name,Leave Type,Total Allowance,Used Days,Pending Days,Remaining Days"
- Empty state: renders gracefully if no approved leaves exist

- [ ] **Step 4: Test security scoping**

While logged in as HR:
- Verify all departments visible
- Filter to one department → only that department's data shown

Log out, log in as Manager:
- Navigate to `/manager/reports` → only own department data
- Navigate to `/hr/reports` → should redirect to `/dashboard`

Log out, log in as Employee:
- Navigate to `/manager/reports` → should redirect to `/dashboard`
- Navigate to `/hr/reports` → should redirect to `/dashboard`

Test CSV export security:
- As Manager, manually hit `/api/reports/export?type=balances&startDate=2026-01-01&endDate=2026-12-31` — should only return own department data
- As Employee, hit the same URL — should return 403

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/hr/reports/page.tsx
git commit -m "feat(reports): add HR reports page with department filter and org-wide charts"
```
