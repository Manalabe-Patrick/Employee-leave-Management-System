"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  submitLeaveRequest,
  cancelLeaveRequest,
} from "@/services/leave.service";

async function requireAuth() {
  const session = await auth();
  if (!session) return null;
  return session;
}

export async function submitLeaveRequestAction(formData: FormData) {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };

  const leaveTypeId = formData.get("leaveTypeId") as string | null;
  const startDateRaw = formData.get("startDate") as string | null;
  const endDateRaw = formData.get("endDate") as string | null;
  const reason = formData.get("reason") as string | null;

  if (!leaveTypeId) return { success: false, error: "Leave type is required" };
  if (!startDateRaw) return { success: false, error: "Start date is required" };
  if (!endDateRaw) return { success: false, error: "End date is required" };
  if (!reason || !reason.trim()) return { success: false, error: "Reason is required" };

  const startDate = new Date(startDateRaw);
  const endDate = new Date(endDateRaw);

  if (isNaN(startDate.getTime())) return { success: false, error: "Invalid start date" };
  if (isNaN(endDate.getTime())) return { success: false, error: "Invalid end date" };
  if (endDate < startDate) return { success: false, error: "End date must be on or after start date" };

  try {
    await submitLeaveRequest(session.user.userId, {
      leaveTypeId,
      startDate,
      endDate,
      reason: reason.trim(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit leave request";
    return { success: false, error: message };
  }

  revalidatePath("/leaves");
  return { success: true };
}

export async function cancelLeaveRequestAction(requestId: string) {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await cancelLeaveRequest(session.user.userId, requestId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel leave request";
    return { success: false, error: message };
  }

  revalidatePath("/leaves");
  return { success: true };
}
