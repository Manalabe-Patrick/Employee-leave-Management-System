import { db } from "@/lib/db";

export async function getAllUsers() {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      departmentId: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { firstName: "asc" },
  });
}

export async function updateUserDepartment(
  userId: string,
  departmentId: string
) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { departmentId },
    });

    const activeLeaveTypes = await tx.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, defaultAllowance: true },
    });

    if (activeLeaveTypes.length > 0) {
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.createMany({
        data: activeLeaveTypes.map((lt) => ({
          userId,
          leaveTypeId: lt.id,
          year: currentYear,
          totalAllowance: lt.defaultAllowance,
        })),
        skipDuplicates: true,
      });
    }

    return user;
  });
}

export async function unassignUserDepartment(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { departmentId: null },
  });
}

export async function updateUserRole(
  userId: string,
  role: "HR" | "EMPLOYEE"
) {
  return db.user.update({
    where: { id: userId },
    data: { role },
  });
}
