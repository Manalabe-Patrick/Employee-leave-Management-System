"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UsageByDepartmentChartProps = {
  data: { departmentName: string; totalDays: number }[];
};

export function UsageByDepartmentChart({ data }: UsageByDepartmentChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Department</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No approved leaves in this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Department</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={data.length * 50 + 40}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="departmentName" width={120} />
            <Tooltip formatter={(value) => [`${value} days`, "Total"]} />
            <Bar dataKey="totalDays" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
