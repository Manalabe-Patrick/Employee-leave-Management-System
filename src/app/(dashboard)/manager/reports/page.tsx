import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUsageByType, getBalanceOverview } from "@/services/report.service";
import { ReportFilters } from "@/components/reports/report-filters";
import { UsageByTypeChart } from "@/components/reports/usage-by-type-chart";
import { BalanceTable } from "@/components/reports/balance-table";
import { CsvExportButton } from "@/components/reports/csv-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") redirect("/dashboard");

  const { departmentId } = session.user;
  if (!departmentId) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const startDate = params.startDate ?? `${now.getFullYear()}-01-01`;
  const endDate = params.endDate ?? now.toISOString().split("T")[0];

  const departmentIds = [departmentId];

  const [usageByType, balances] = await Promise.all([
    getUsageByType(new Date(startDate), new Date(endDate), departmentIds),
    getBalanceOverview(departmentIds),
  ]);

  const totalDaysUsed = usageByType.reduce((sum, d) => sum + d.totalDays, 0);
  const uniqueEmployees = new Set(balances.map((b) => b.userName)).size;
  const mostUsedType = usageByType[0]?.leaveTypeName ?? "—";

  const deptParam = departmentIds.join(",");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Department Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Leave usage analytics for your department
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReportFilters startDate={startDate} endDate={endDate} />
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 pb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Days Used</p>
            <p className="text-3xl font-bold mt-2">{totalDaysUsed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Employees</p>
            <p className="text-3xl font-bold mt-2">{uniqueEmployees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Most Used Type</p>
            <p className="text-3xl font-bold mt-2">{mostUsedType}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <UsageByTypeChart data={usageByType} variant="bar" />
        <UsageByTypeChart data={usageByType} variant="pie" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold">Balance Overview</CardTitle>
          <div className="flex gap-2">
            <CsvExportButton
              startDate={startDate}
              endDate={endDate}
              departments={deptParam}
              exportType="usage-by-type"
            />
            <CsvExportButton
              startDate={startDate}
              endDate={endDate}
              departments={deptParam}
              exportType="balances"
            />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <BalanceTable data={balances} />
        </CardContent>
      </Card>
    </div>
  );
}
