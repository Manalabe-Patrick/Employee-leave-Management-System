import { db } from "@/lib/db";

export async function getAllDepartments() {
  return db.department.findMany({
    include: {
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(data: {
  name: string;
  description: string | null;
  managerId: string;
}) {
  return db.$transaction(async (tx) => {
    const department = await tx.department.create({
      data: {
        name: data.name,
        description: data.description,
        managerId: data.managerId,
      },
    });

    await tx.user.update({
      where: { id: data.managerId },
      data: { role: "MANAGER", departmentId: department.id },
    });

    const activeLeaveTypes = await tx.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, defaultAllowance: true },
    });

    if (activeLeaveTypes.length > 0) {
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.createMany({
        data: activeLeaveTypes.map((lt) => ({
          userId: data.managerId,
          leaveTypeId: lt.id,
          year: currentYear,
          totalAllowance: lt.defaultAllowance,
        })),
        skipDuplicates: true,
      });
    }

    return department;
  });
}

export async function updateDepartment(
  id: string,
  data: {
    name: string;
    description: string | null;
    managerId: string;
  }
) {
  return db.$transaction(async (tx) => {
    const current = await tx.department.findUniqueOrThrow({
      where: { id },
      select: { managerId: true },
    });

    const department = await tx.department.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        managerId: data.managerId,
      },
    });

    if (current.managerId !== data.managerId) {
      const oldManager = await tx.user.findUniqueOrThrow({
        where: { id: current.managerId },
        select: { role: true },
      });
      if (oldManager.role !== "HR") {
        await tx.user.update({
          where: { id: current.managerId },
          data: { role: "EMPLOYEE" },
        });
      }

      await tx.user.update({
        where: { id: data.managerId },
        data: { role: "MANAGER", departmentId: department.id },
      });

      const activeLeaveTypes = await tx.leaveType.findMany({
        where: { isActive: true },
        select: { id: true, defaultAllowance: true },
      });

      if (activeLeaveTypes.length > 0) {
        const currentYear = new Date().getFullYear();
        await tx.leaveBalance.createMany({
          data: activeLeaveTypes.map((lt) => ({
            userId: data.managerId,
            leaveTypeId: lt.id,
            year: currentYear,
            totalAllowance: lt.defaultAllowance,
          })),
          skipDuplicates: true,
        });
      }
    }

    return department;
  });
}

export async function deleteDepartment(id: string) {
  return db.$transaction(async (tx) => {
    const department = await tx.department.findUniqueOrThrow({
      where: { id },
    });

    // Count employees excluding the manager
    const employeeCount = await tx.user.count({
      where: { departmentId: id, id: { not: department.managerId } },
    });

    if (employeeCount > 0) {
      throw new Error("DEPARTMENT_HAS_EMPLOYEES");
    }

    const manager = await tx.user.findUniqueOrThrow({
      where: { id: department.managerId },
      select: { role: true },
    });

    // Null out manager's departmentId (and demote role) before deleting
    if (manager.role !== "HR") {
      await tx.user.update({
        where: { id: department.managerId },
        data: { role: "EMPLOYEE", departmentId: null },
      });
    } else {
      await tx.user.update({
        where: { id: department.managerId },
        data: { departmentId: null },
      });
    }

    await tx.department.delete({ where: { id } });

    return department;
  });
}
