import { db } from "@/lib/db";

export type CalendarLeave = {
  id: string;
  userName: string;
  leaveTypeName: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  departmentName: string;
};

export async function getCalendarLeaves(
  month: number,
  year: number,
  departmentIds?: string[]
): Promise<CalendarLeave[]> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const where: Record<string, unknown> = {
    status: "APPROVED",
    startDate: { lte: lastDay },
    endDate: { gte: firstDay },
  };

  if (departmentIds && departmentIds.length > 0) {
    where.user = { departmentId: { in: departmentIds } };
  }

  const requests = await db.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return requests.map((r) => ({
    id: r.id,
    userName: `${r.user.firstName} ${r.user.lastName}`,
    leaveTypeName: r.leaveType.name,
    leaveTypeId: r.leaveType.id,
    startDate: r.startDate.toISOString().split("T")[0],
    endDate: r.endDate.toISOString().split("T")[0],
    departmentName: r.user.department?.name ?? "Unassigned",
  }));
}
