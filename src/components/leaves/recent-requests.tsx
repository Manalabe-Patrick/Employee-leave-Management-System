import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusBadgeStyles } from "@/lib/constants";

type LeaveRequest = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  totalDays: number;
  status: string;
  createdAt: Date | string;
  leaveType: { id: string; name: string };
};

type RecentRequestsProps = {
  requests: LeaveRequest[];
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecentRequests({ requests }: RecentRequestsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Requests</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/leaves" />}
          >
            View all
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/leaves/new" />}>
            <Plus className="mr-1 h-4 w-4" />
            Request Leave
          </Button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No leave requests yet
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const badge = statusBadgeStyles[r.status] ?? {
                  className: "",
                  label: r.status,
                };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.leaveType.name}
                    </TableCell>
                    <TableCell>
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </TableCell>
                    <TableCell className="text-center">{r.totalDays}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
