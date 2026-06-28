"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import { cancelLeaveRequestAction } from "@/app/(dashboard)/leaves/actions";
import { statusBadgeStyles } from "@/lib/constants";

interface LeaveRequest {
  id: string;
  leaveTypeId: string;
  startDate: string | Date;
  endDate: string | Date;
  totalDays: number;
  reason: string;
  status: string;
  createdAt: string | Date;
  leaveType: { id: string; name: string };
}

interface LeaveTypeOption {
  id: string;
  name: string;
}

interface LeaveHistoryTableProps {
  requests: LeaveRequest[];
  leaveTypes: LeaveTypeOption[];
}

const STATUS_ALL = "__all__";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LeaveHistoryTable({
  requests,
  leaveTypes,
}: LeaveHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [typeFilter, setTypeFilter] = useState(STATUS_ALL);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = requests.filter((r) => {
    if (statusFilter !== STATUS_ALL && r.status !== statusFilter) return false;
    if (typeFilter !== STATUS_ALL && r.leaveTypeId !== typeFilter) return false;
    return true;
  });

  function openCancelDialog(id: string) {
    setCancellingId(id);
    setCancelDialogOpen(true);
    setError("");
  }

  async function handleCancel() {
    if (!cancellingId) return;
    setCancelLoading(true);
    setError("");

    const result = await cancelLeaveRequestAction(cancellingId);
    setCancelLoading(false);

    if (!result.success) {
      setError(result.error || "Failed to cancel request");
      return;
    }

    setCancelDialogOpen(false);
    setCancellingId(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">My Leaves</h1>
        <Button nativeButton={false} render={<Link href="/leaves/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          Request Leave
        </Button>
      </div>

      <div className="flex gap-4 mb-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? STATUS_ALL)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>All Statuses</SelectItem>
            <SelectItem value="PENDING_MANAGER">Pending Manager</SelectItem>
            <SelectItem value="PENDING_HR">Pending HR</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? STATUS_ALL)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>All Types</SelectItem>
            {leaveTypes.map((lt) => (
              <SelectItem key={lt.id} value={lt.id}>
                {lt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leave Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-center">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No leave requests found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const badge = statusBadgeStyles[r.status] ?? {
                  className: "",
                  label: r.status,
                };
                const canCancel =
                  r.status === "PENDING_MANAGER" || r.status === "PENDING_HR";

                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.leaveType.name}
                    </TableCell>
                    <TableCell>{formatDate(r.startDate)}</TableCell>
                    <TableCell>{formatDate(r.endDate)}</TableCell>
                    <TableCell className="text-center">{r.totalDays}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCancelDialog(r.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Leave Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this leave request? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading ? "Cancelling..." : "Cancel Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
