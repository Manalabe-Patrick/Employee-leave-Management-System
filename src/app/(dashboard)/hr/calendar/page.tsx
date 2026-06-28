import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";
import { getAllDepartments } from "@/services/department.service";
import { TeamCalendar } from "@/components/calendar/team-calendar";

export default async function HRCalendarPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [leaves, departments] = await Promise.all([
    getCalendarLeaves(month, year),
    getAllDepartments(),
  ]);

  const deptList = departments.map((d) => ({ id: d.id, name: d.name }));
  const allDeptIds = deptList.map((d) => d.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team Calendar</h1>
      <TeamCalendar
        initialLeaves={leaves}
        initialMonth={month}
        initialYear={year}
        role="HR"
        departments={deptList}
        initialDepartmentIds={allDeptIds}
      />
    </div>
  );
}
