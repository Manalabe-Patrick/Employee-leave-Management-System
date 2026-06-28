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
