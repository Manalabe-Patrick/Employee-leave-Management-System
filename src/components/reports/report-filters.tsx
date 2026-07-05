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
      <div className="space-y-1.5">
        <Label htmlFor="startDate" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-40 rounded-lg"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endDate" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">End Date</Label>
        <Input
          id="endDate"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-40 rounded-lg"
        />
      </div>
      {showDepartments && departments && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Departments</Label>
          <DepartmentFilter
            departments={departments}
            selected={deptIds}
            onChange={setDeptIds}
          />
        </div>
      )}
      <Button onClick={handleApply} size="sm" className="gap-2 rounded-full px-5">
        <Search className="size-4" />
        Apply
      </Button>
      <Button onClick={handleReset} variant="outline" size="sm" className="gap-2 rounded-full px-5">
        <RotateCcw className="size-4" />
        Reset
      </Button>
    </div>
  );
}
