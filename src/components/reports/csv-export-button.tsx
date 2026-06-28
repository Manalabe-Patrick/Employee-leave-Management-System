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
