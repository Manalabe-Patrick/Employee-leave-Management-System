"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  updateUserDepartment,
  unassignUserDepartment,
  updateUserRole,
} from "@/services/user.service";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") {
    return null;
  }
  return session;
}

export async function updateUserDepartmentAction(
  userId: string,
  departmentId: string | null
) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    if (departmentId) {
      await updateUserDepartment(userId, departmentId);
    } else {
      await unassignUserDepartment(userId);
    }
  } catch {
    return { success: false, error: "Failed to update department assignment" };
  }

  revalidatePath("/hr/users");
  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  if (role !== "HR" && role !== "EMPLOYEE") {
    return { success: false, error: "Role must be HR or EMPLOYEE" };
  }

  try {
    await updateUserRole(userId, role);
  } catch {
    return { success: false, error: "Failed to update user role" };
  }

  revalidatePath("/hr/users");
  return { success: true };
}
