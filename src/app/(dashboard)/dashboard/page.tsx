import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { roleBadgeClasses } from "@/lib/constants";
import {
  getUserLeaveBalances,
  getRecentLeaveRequests,
  getPendingManagerCount,
  getPendingHRCount,
} from "@/services/leave.service";
import { DashboardAlerts } from "@/components/layout/dashboard-alerts";
import { LeaveBalanceCards } from "@/components/leaves/leave-balance-cards";
import { RecentRequests } from "@/components/leaves/recent-requests";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { userId, name, role } = session.user;
  const firstName = name.split(" ")[0];

  const [balances, recentRequests, pendingManagerCount, pendingHRCount] =
    await Promise.all([
      getUserLeaveBalances(userId),
      getRecentLeaveRequests(userId, 5),
      role === "MANAGER" ? getPendingManagerCount(userId) : Promise.resolve(0),
      role === "HR" ? getPendingHRCount() : Promise.resolve(0),
    ]);

  const now = new Date();
  const day = now.getDate();
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-foreground/10">
            <span className="text-2xl font-bold leading-none">{day}</span>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium">{weekday},</p>
              <p className="text-sm text-muted-foreground">{month}</p>
            </div>
            <div className="mx-1 h-8 w-px bg-border" />
            <Link
              href="/leaves"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              My Leaves <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/calendar"
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Calendar className="size-4" />
            </Link>
          </div>
        </div>

        <div className="md:text-right">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Hey, {firstName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your time off{" "}
            <span
              className={`ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeClasses[role]}`}
            >
              {role}
            </span>
          </p>
        </div>
      </div>

      <DashboardAlerts
        role={role}
        pendingManagerCount={pendingManagerCount}
        pendingHRCount={pendingHRCount}
      />

      <div>
        <h2 className="text-lg font-semibold mb-4">Leave Balances</h2>
        <LeaveBalanceCards balances={balances} />
      </div>

      <RecentRequests requests={recentRequests} />
    </div>
  );
}
