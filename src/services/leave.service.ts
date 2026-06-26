import { db } from "@/lib/db";

export async function getAllLeaveTypes() {
  return db.leaveType.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createLeaveType(data: {
  name: string;
  description: string | null;
  defaultAllowance: number;
  isPaid: boolean;
}) {
  return db.$transaction(async (tx) => {
    const leaveType = await tx.leaveType.create({ data });

    const usersWithDepartment = await tx.user.findMany({
      where: { departmentId: { not: null } },
      select: { id: true },
    });

    if (usersWithDepartment.length > 0) {
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.createMany({
        data: usersWithDepartment.map((user) => ({
          userId: user.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
          totalAllowance: data.defaultAllowance,
          usedDays: 0,
          pendingDays: 0,
        })),
      });
    }

    return leaveType;
  });
}

export async function updateLeaveType(
  id: string,
  data: {
    name: string;
    description: string | null;
    defaultAllowance: number;
    isPaid: boolean;
  }
) {
  return db.leaveType.update({
    where: { id },
    data,
  });
}

export async function toggleLeaveTypeActive(id: string) {
  const leaveType = await db.leaveType.findUniqueOrThrow({ where: { id } });
  return db.leaveType.update({
    where: { id },
    data: { isActive: !leaveType.isActive },
  });
}
