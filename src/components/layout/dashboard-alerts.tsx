import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type DashboardAlertsProps = {
  role: "EMPLOYEE" | "MANAGER" | "HR";
  pendingManagerCount?: number;
  pendingHRCount?: number;
};

export function DashboardAlerts({
  role,
  pendingManagerCount,
  pendingHRCount,
}: DashboardAlertsProps) {
  if (role === "EMPLOYEE") return null;

  const alerts: { href: string; message: string }[] = [];

  if (role === "MANAGER" && pendingManagerCount && pendingManagerCount > 0) {
    alerts.push({
      href: "/manager/approvals",
      message: `You have ${pendingManagerCount} request${pendingManagerCount === 1 ? "" : "s"} to review`,
    });
  }

  if (role === "HR" && pendingHRCount && pendingHRCount > 0) {
    alerts.push({
      href: "/hr/approvals",
      message: `You have ${pendingHRCount} request${pendingHRCount === 1 ? "" : "s"} awaiting final approval`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Link
          key={alert.href}
          href={alert.href}
          className="flex items-center gap-3 rounded-2xl bg-primary/5 px-5 py-4 text-sm font-medium text-foreground ring-1 ring-primary/15 transition-colors hover:bg-primary/10"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {alert.message}
        </Link>
      ))}
    </div>
  );
}
