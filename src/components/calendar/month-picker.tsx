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
      <Button variant="outline" size="sm" onClick={handlePrev} aria-label="Previous month">
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

      <Button variant="outline" size="sm" onClick={handleNext} aria-label="Next month">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
