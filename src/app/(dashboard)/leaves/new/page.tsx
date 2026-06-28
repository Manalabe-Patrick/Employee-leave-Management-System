import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserLeaveBalances } from "@/services/leave.service";
import { LeaveRequestForm } from "@/components/leaves/leave-request-form";

export default async function NewLeavePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const balances = await getUserLeaveBalances(session.user.userId);

  return <LeaveRequestForm balances={balances} />;
}
