"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#C45A3C", "#E8967F", "#1A1A1A", "#A3A3A3", "#D4886E", "#8B4332", "#F0C4B8", "#6B3425"];

type UsageByTypeChartProps = {
  data: { leaveTypeName: string; totalDays: number }[];
  variant?: "pie" | "bar";
};

export function UsageByTypeChart({ data, variant = "pie" }: UsageByTypeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Leave Type</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No approved leaves in this period.</p>
        </CardContent>
      </Card>
    );
  }

  if (variant === "bar") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Leave Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={data.length * 50 + 40}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="leaveTypeName" width={120} />
              <Tooltip formatter={(value) => [`${value} days`, "Total"]} />
              <Bar dataKey="totalDays" radius={[0, 6, 6, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.totalDays, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Leave Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="totalDays"
              nameKey="leaveTypeName"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(props) => {
                const entry = props as unknown as { leaveTypeName: string; totalDays: number };
                return `${entry.leaveTypeName}: ${entry.totalDays}d`;
              }}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${value} days (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`,
                name,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
