import { db } from "@/lib/db";
import { calculateBusinessDays } from "@/lib/date-utils";

export { calculateBusinessDays };

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

export async function getUserLeaveBalances(userId: string) {
  const currentYear = new Date().getFullYear();
  return db.leaveBalance.findMany({
    where: {
      userId,
      year: currentYear,
      leaveType: { isActive: true },
    },
    include: {
      leaveType: {
        select: { id: true, name: true, isActive: true },
      },
    },
    orderBy: { leaveType: { name: "asc" } },
  });
}
