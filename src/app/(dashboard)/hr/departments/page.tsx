import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllDepartments } from "@/services/department.service";
import { getAllUsers } from "@/services/user.service";
import { DepartmentTable } from "@/components/departments/department-table";

export default async function DepartmentsPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const [departments, users] = await Promise.all([
    getAllDepartments(),
    getAllUsers(),
  ]);

  return (
    <DepartmentTable
      departments={departments}
      users={users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
      }))}
    />
  );
}
