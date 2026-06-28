import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingHRRequests } from "@/services/leave.service";
import { HRApprovalsList } from "./hr-approvals-list";

export default async function HRApprovalsPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const requests = await getPendingHRRequests();

  const mapped = requests.map((r) => ({
    ...r,
    departmentName: r.user.department?.name,
  }));

  return <HRApprovalsList requests={mapped} />;
}
