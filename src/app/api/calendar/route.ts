import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCalendarLeaves } from "@/services/calendar.service";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const month = parseInt(searchParams.get("month") ?? "", 10);
  const year = parseInt(searchParams.get("year") ?? "", 10);

  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
  }

  const { role, departmentId } = session.user;

  let departmentIds: string[] | undefined;

  if (role === "HR") {
    const rawIds = searchParams.get("departmentIds");
    if (rawIds) {
      departmentIds = rawIds.split(",").filter(Boolean);
    }
  } else {
    if (!departmentId) {
      return NextResponse.json([]);
    }
    departmentIds = [departmentId];
  }

  const leaves = await getCalendarLeaves(month, year, departmentIds);
  return NextResponse.json(leaves);
}
