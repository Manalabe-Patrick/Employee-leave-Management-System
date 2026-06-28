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
