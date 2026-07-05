"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/services/department.service";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") {
    return null;
  }
  return session;
}

export async function createDepartmentAction(formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const managerId = formData.get("managerId") as string | null;

  if (!name || !name.trim()) {
    return { success: false, error: "Department name is required" };
  }
  if (!managerId) {
    return { success: false, error: "Manager is required" };
  }

  try {
    await createDepartment({
      name: name.trim(),
      description: description?.trim() || null,
      managerId,
    });
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes("managerId")) {
        return { success: false, error: "This user already manages another department" };
      }
      return { success: false, error: "A department with this name already exists" };
    }
    return { success: false, error: "Failed to create department" };
  }

  revalidatePath("/hr/departments");
  return { success: true };
}

export async function updateDepartmentAction(id: string, formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const managerId = formData.get("managerId") as string | null;

  if (!name || !name.trim()) {
    return { success: false, error: "Department name is required" };
  }
  if (!managerId) {
    return { success: false, error: "Manager is required" };
  }

  try {
    await updateDepartment(id, {
      name: name.trim(),
      description: description?.trim() || null,
      managerId,
    });
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes("managerId")) {
        return { success: false, error: "This user already manages another department" };
      }
      return { success: false, error: "A department with this name already exists" };
    }
    return { success: false, error: "Failed to update department" };
  }

  revalidatePath("/hr/departments");
  return { success: true };
}

export async function deleteDepartmentAction(id: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await deleteDepartment(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "DEPARTMENT_HAS_EMPLOYEES") {
      return { success: false, error: "Cannot delete a department that has employees assigned" };
    }
    return { success: false, error: "Failed to delete department" };
  }

  revalidatePath("/hr/departments");
  return { success: true };
}
