import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";
import { TeamCalendar } from "@/components/calendar/team-calendar";
import { db } from "@/lib/db";

export default async function ManagerCalendarPage() {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") redirect("/dashboard");

  const department = await db.department.findFirst({
    where: { managerId: session.user.userId },
    select: { id: true },
  });

  if (!department) redirect("/dashboard");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const leaves = await getCalendarLeaves(month, year, [department.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team Calendar</h1>
      <TeamCalendar
        initialLeaves={leaves}
        initialMonth={month}
        initialYear={year}
        role="MANAGER"
      />
    </div>
  );
}
