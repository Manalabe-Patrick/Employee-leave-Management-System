"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createLeaveType,
  updateLeaveType,
  toggleLeaveTypeActive,
} from "@/services/leave.service";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") {
    return null;
  }
  return session;
}

export async function createLeaveTypeAction(formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const defaultAllowanceRaw = formData.get("defaultAllowance") as string | null;
  const isPaid = formData.get("isPaid") === "on";

  if (!name || !name.trim()) {
    return { success: false, error: "Name is required" };
  }
  const defaultAllowance = Number(defaultAllowanceRaw);
  if (!Number.isInteger(defaultAllowance) || defaultAllowance < 1) {
    return { success: false, error: "Default allowance must be a positive whole number" };
  }

  try {
    await createLeaveType({
      name: name.trim(),
      description: description?.trim() || null,
      defaultAllowance,
      isPaid,
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return { success: false, error: "A leave type with this name already exists" };
    }
    return { success: false, error: "Failed to create leave type" };
  }

  revalidatePath("/hr/leave-types");
  return { success: true };
}

export async function updateLeaveTypeAction(id: string, formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const defaultAllowanceRaw = formData.get("defaultAllowance") as string | null;
  const isPaid = formData.get("isPaid") === "on";

  if (!name || !name.trim()) {
    return { success: false, error: "Name is required" };
  }
  const defaultAllowance = Number(defaultAllowanceRaw);
  if (!Number.isInteger(defaultAllowance) || defaultAllowance < 1) {
    return { success: false, error: "Default allowance must be a positive whole number" };
  }

  try {
    await updateLeaveType(id, {
      name: name.trim(),
      description: description?.trim() || null,
      defaultAllowance,
      isPaid,
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return { success: false, error: "A leave type with this name already exists" };
    }
    return { success: false, error: "Failed to update leave type" };
  }

  revalidatePath("/hr/leave-types");
  return { success: true };
}

export async function toggleLeaveTypeActiveAction(id: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await toggleLeaveTypeActive(id);
  } catch {
    return { success: false, error: "Failed to toggle leave type status" };
  }

  revalidatePath("/hr/leave-types");
  return { success: true };
}
