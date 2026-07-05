import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getUserLeaveRequests,
  getAllLeaveTypes,
  getUserLeaveBalances,
} from "@/services/leave.service";
import { LeaveHistoryTable } from "@/components/leaves/leave-history-table";

export default async function LeavesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [requests, leaveTypes, balances] = await Promise.all([
    getUserLeaveRequests(session.user.userId),
    getAllLeaveTypes(),
    getUserLeaveBalances(session.user.userId),
  ]);

  const activeTypes = leaveTypes
    .filter((lt) => lt.isActive)
    .map((lt) => ({ id: lt.id, name: lt.name }));

  return (
    <LeaveHistoryTable
      requests={requests}
      leaveTypes={activeTypes}
      balances={balances}
      userName={session.user.name}
    />
  );
}
