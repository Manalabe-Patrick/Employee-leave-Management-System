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

export async function submitLeaveRequest(
  userId: string,
  data: {
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  }
) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.departmentId) {
      throw new Error("You must be assigned to a department before submitting leave");
    }

    const leaveType = await tx.leaveType.findUniqueOrThrow({
      where: { id: data.leaveTypeId },
    });
    if (!leaveType.isActive) {
      throw new Error("This leave type is no longer active");
    }

    const totalDays = calculateBusinessDays(data.startDate, data.endDate);
    if (totalDays === 0) {
      throw new Error("Selected date range contains no business days");
    }

    const currentYear = new Date().getFullYear();
    const balance = await tx.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId: data.leaveTypeId,
          year: currentYear,
        },
      },
    });
    if (!balance) {
      throw new Error("No leave balance found for this leave type");
    }

    const remaining = balance.totalAllowance - balance.usedDays - balance.pendingDays;
    if (totalDays > remaining) {
      throw new Error(
        `Insufficient balance. You have ${remaining} day${remaining === 1 ? "" : "s"} remaining`
      );
    }

    const overlap = await tx.leaveRequest.findFirst({
      where: {
        userId,
        status: { not: "CANCELLED" },
        startDate: { lte: data.endDate },
        endDate: { gte: data.startDate },
      },
    });
    if (overlap) {
      throw new Error("You already have a leave request that overlaps with these dates");
    }

    const request = await tx.leaveRequest.create({
      data: {
        userId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
        reason: data.reason,
        status: "PENDING_MANAGER",
      },
    });

    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId: data.leaveTypeId,
          year: currentYear,
        },
      },
      data: {
        pendingDays: { increment: totalDays },
      },
    });

    return request;
  });
}

export async function cancelLeaveRequest(userId: string, requestId: string) {
  return db.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    if (request.userId !== userId) {
      throw new Error("You can only cancel your own leave requests");
    }

    if (request.status !== "PENDING_MANAGER" && request.status !== "PENDING_HR") {
      throw new Error("Only pending requests can be cancelled");
    }

    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });

    const currentYear = new Date().getFullYear();
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId: request.leaveTypeId,
          year: currentYear,
        },
      },
      data: {
        pendingDays: { decrement: request.totalDays },
      },
    });

    return updated;
  });
}

export async function getUserLeaveRequests(
  userId: string,
  filters?: { status?: string; leaveTypeId?: string }
) {
  const where: Record<string, unknown> = { userId };
  if (filters?.status) where.status = filters.status;
  if (filters?.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;

  return db.leaveRequest.findMany({
    where,
    include: {
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
