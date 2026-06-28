import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";
import { TeamCalendar } from "@/components/calendar/team-calendar";

export default async function ManagerCalendarPage() {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") redirect("/dashboard");

  const { departmentId } = session.user;
  if (!departmentId) redirect("/dashboard");

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
        role="MANAGER"
        initialDepartmentIds={[departmentId]}
      />
    </div>
  );
}
