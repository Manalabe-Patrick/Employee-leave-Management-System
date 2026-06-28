"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { reviewLeaveRequest } from "@/services/leave.service";
import {
  notifyLeaveApproved,
  notifyLeaveDeclined,
  getLeaveRequestWithDetails,
} from "@/services/notification.service";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") return null;
  return session;
}

export async function hrApproveAction(requestId: string, comment: string) {
  const session = await requireHR();
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

  revalidatePath("/hr/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}

export async function hrDeclineAction(requestId: string, comment: string) {
  const session = await requireHR();
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

  revalidatePath("/hr/approvals");
  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}
