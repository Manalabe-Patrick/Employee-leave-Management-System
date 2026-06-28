import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingManagerRequests } from "@/services/leave.service";
import { ManagerApprovalsList } from "./manager-approvals-list";

export default async function ManagerApprovalsPage() {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") redirect("/dashboard");

  const requests = await getPendingManagerRequests(session.user.userId);

  return <ManagerApprovalsList requests={requests} />;
}
