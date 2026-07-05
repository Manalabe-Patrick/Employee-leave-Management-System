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
    "relative flex flex-col items-start p-2.5 min-h-[80px] rounded-xl text-sm transition-colors",
    isCurrentMonth
      ? isToday
        ? "bg-primary/5 ring-1 ring-primary/20"
        : "bg-card"
      : "bg-transparent opacity-30",
  ]
    .filter(Boolean)
    .join(" ");

  const dayNumber = isToday ? (
    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {day}
    </span>
  ) : (
    <span className="text-xs font-medium">{day}</span>
  );

  if (!hasLeaves) {
    return (
      <div className={cellClasses}>
        {dayNumber}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className={`${cellClasses} cursor-default hover:bg-muted/40`} />}
      >
        {dayNumber}
        <div className="mt-auto pt-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
