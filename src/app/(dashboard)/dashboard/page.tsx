import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">
          You are logged in as{" "}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClasses[role]}`}
          >
            {role}
          </span>
        </p>
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
