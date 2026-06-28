import { db } from "@/lib/db";

export async function getUsageByDepartment(
  startDate: Date,
  endDate: Date,
  departmentIds?: string[]
): Promise<{ departmentName: string; totalDays: number }[]> {
  const where: Record<string, unknown> = {
    status: "APPROVED",
    startDate: { lte: endDate },
    endDate: { gte: startDate },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const requests = await db.leaveRequest.findMany({
    where,
    select: {
      totalDays: true,
      user: {
        select: {
          department: { select: { name: true } },
        },
      },
    },
  });

  const byDept = new Map<string, number>();
  for (const r of requests) {
    const name = r.user.department?.name ?? "Unassigned";
    byDept.set(name, (byDept.get(name) ?? 0) + r.totalDays);
  }

  return Array.from(byDept.entries())
    .map(([departmentName, totalDays]) => ({ departmentName, totalDays }))
    .sort((a, b) => b.totalDays - a.totalDays);
}

export async function getUsageByType(
  startDate: Date,
  endDate: Date,
  departmentIds?: string[]
): Promise<{ leaveTypeName: string; totalDays: number }[]> {
  const where: Record<string, unknown> = {
    status: "APPROVED",
    startDate: { lte: endDate },
    endDate: { gte: startDate },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const requests = await db.leaveRequest.findMany({
    where,
    select: {
      totalDays: true,
      leaveType: { select: { name: true } },
    },
  });

  const byType = new Map<string, number>();
  for (const r of requests) {
    const name = r.leaveType.name;
    byType.set(name, (byType.get(name) ?? 0) + r.totalDays);
  }

  return Array.from(byType.entries())
    .map(([leaveTypeName, totalDays]) => ({ leaveTypeName, totalDays }))
    .sort((a, b) => b.totalDays - a.totalDays);
}

export async function getBalanceOverview(
  departmentIds?: string[]
): Promise<{
  userName: string;
  leaveTypeName: string;
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}[]> {
  const currentYear = new Date().getFullYear();

  const where: Record<string, unknown> = {
    year: currentYear,
    leaveType: { isActive: true },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const balances = await db.leaveBalance.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      leaveType: { select: { name: true } },
    },
    orderBy: [
      { user: { firstName: "asc" } },
      { leaveType: { name: "asc" } },
    ],
  });

  return balances.map((b) => ({
    userName: `${b.user.firstName} ${b.user.lastName}`,
    leaveTypeName: b.leaveType.name,
    totalAllowance: b.totalAllowance,
    usedDays: b.usedDays,
    pendingDays: b.pendingDays,
    remainingDays: b.totalAllowance - b.usedDays - b.pendingDays,
  }));
}
