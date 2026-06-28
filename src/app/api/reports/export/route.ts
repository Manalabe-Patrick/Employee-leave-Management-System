import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUsageByDepartment,
  getUsageByType,
  getBalanceOverview,
} from "@/services/report.service";

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, departmentId } = session.user;
  if (role !== "MANAGER" && role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const startDateStr = params.get("startDate");
  const endDateStr = params.get("endDate");
  const type = params.get("type");

  if (!startDateStr || !endDateStr || !type) {
    return NextResponse.json(
      { error: "Missing required params: startDate, endDate, type" },
      { status: 400 }
    );
  }

  const validTypes = ["usage-by-department", "usage-by-type", "balances"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  let departmentIds: string[] | undefined;
  if (role === "MANAGER") {
    if (!departmentId) {
      return NextResponse.json(
        { error: "Manager has no department" },
        { status: 400 }
      );
    }
    departmentIds = [departmentId];
  } else {
    const rawDepts = params.get("departments");
    if (rawDepts) {
      departmentIds = rawDepts.split(",").filter(Boolean);
    }
  }

  let csv: string;

  if (type === "usage-by-department") {
    const data = await getUsageByDepartment(startDate, endDate, departmentIds);
    csv = toCsv(
      ["Department", "Total Days Used"],
      data.map((d) => [d.departmentName, d.totalDays])
    );
  } else if (type === "usage-by-type") {
    const data = await getUsageByType(startDate, endDate, departmentIds);
    csv = toCsv(
      ["Leave Type", "Total Days Used"],
      data.map((d) => [d.leaveTypeName, d.totalDays])
    );
  } else {
    const data = await getBalanceOverview(departmentIds);
    csv = toCsv(
      [
        "Employee Name",
        "Leave Type",
        "Total Allowance",
        "Used Days",
        "Pending Days",
        "Remaining Days",
      ],
      data.map((d) => [
        d.userName,
        d.leaveTypeName,
        d.totalAllowance,
        d.usedDays,
        d.pendingDays,
        d.remainingDays,
      ])
    );
  }

  const today = new Date().toISOString().split("T")[0];
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="report-${type}-${today}.csv"`,
    },
  });
}
