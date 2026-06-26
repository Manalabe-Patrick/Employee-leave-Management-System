import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllLeaveTypes } from "@/services/leave.service";
import { LeaveTypeTable } from "@/components/leaves/leave-type-table";

export default async function LeaveTypesPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const leaveTypes = await getAllLeaveTypes();

  return <LeaveTypeTable leaveTypes={leaveTypes} />;
}
