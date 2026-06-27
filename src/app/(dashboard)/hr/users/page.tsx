import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllUsers } from "@/services/user.service";
import { getAllDepartments } from "@/services/department.service";
import { UserTable } from "@/components/users/user-table";

export default async function UsersPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const [users, departments] = await Promise.all([
    getAllUsers(),
    getAllDepartments(),
  ]);

  return (
    <UserTable
      users={users}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
    />
  );
}
