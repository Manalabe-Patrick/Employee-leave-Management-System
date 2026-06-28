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
