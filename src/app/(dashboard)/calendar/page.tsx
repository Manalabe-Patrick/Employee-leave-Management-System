import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";
import { TeamCalendar } from "@/components/calendar/team-calendar";

export default async function EmployeeCalendarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { departmentId, role } = session.user;

  if (!departmentId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Team Calendar</h1>
        <p className="text-sm text-muted-foreground">
          You must be assigned to a department to view the team calendar.
        </p>
      </div>
    );
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const leaves = await getCalendarLeaves(month, year, [departmentId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team Calendar</h1>
      <TeamCalendar
        initialLeaves={leaves}
        initialMonth={month}
        initialYear={year}
        role={role}
        initialDepartmentIds={[departmentId]}
      />
    </div>
  );
}
