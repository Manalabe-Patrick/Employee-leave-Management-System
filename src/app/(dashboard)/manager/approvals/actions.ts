"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { reviewLeaveRequest } from "@/services/leave.service";
import {
  notifyLeaveApproved,
  notifyLeaveDeclined,
  getLeaveRequestWithDetails,
} from "@/services/notification.service";

async function requireManager() {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") return null;
  return session;
}

export async function managerApproveAction(requestId: string, comment: string) {
  const session = await requireManager();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "approve", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to approve request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(requestId);
  if (request) {
    notifyLeaveApproved(request).catch(() => {});
  }

  revalidatePath("/manager/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}

export async function managerDeclineAction(requestId: string, comment: string) {
  const session = await requireManager();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await reviewLeaveRequest(session.user.userId, requestId, "decline", comment);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to decline request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(requestId);
  if (request) {
    notifyLeaveDeclined(request, session.user.name).catch(() => {});
  }

  revalidatePath("/manager/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}
