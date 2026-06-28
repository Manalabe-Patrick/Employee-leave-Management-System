"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  submitLeaveRequest,
  cancelLeaveRequest,
} from "@/services/leave.service";
import { parseLocalDate } from "@/lib/date-utils";
import {
  notifyLeaveSubmitted,
  notifyLeaveCancelled,
  getLeaveRequestWithDetails,
} from "@/services/notification.service";

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

  const startDate = parseLocalDate(startDateRaw);
  const endDate = parseLocalDate(endDateRaw);

  if (isNaN(startDate.getTime())) return { success: false, error: "Invalid start date" };
  if (isNaN(endDate.getTime())) return { success: false, error: "Invalid end date" };
  if (endDate < startDate) return { success: false, error: "End date must be on or after start date" };

  let createdId: string;
  try {
    const result = await submitLeaveRequest(session.user.userId, {
      leaveTypeId,
      startDate,
      endDate,
      reason: reason.trim(),
    });
    createdId = result.id;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit leave request";
    return { success: false, error: message };
  }

  const request = await getLeaveRequestWithDetails(createdId);
  if (request) {
    notifyLeaveSubmitted(request).catch(() => {});
  }

  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}

export async function cancelLeaveRequestAction(requestId: string) {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };

  // Fetch BEFORE cancelling — notifyLeaveCancelled needs the pre-cancel status
  // to know whether HR was involved (PENDING_HR) or just the manager (PENDING_MANAGER)
  const requestDetails = await getLeaveRequestWithDetails(requestId);

  try {
    await cancelLeaveRequest(session.user.userId, requestId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel leave request";
    return { success: false, error: message };
  }

  if (requestDetails) {
    notifyLeaveCancelled(requestDetails).catch(() => {});
  }

  revalidatePath("/leaves");
  revalidatePath("/");
  return { success: true };
}
