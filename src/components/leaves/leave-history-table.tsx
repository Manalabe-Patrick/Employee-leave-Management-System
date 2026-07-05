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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X, ArrowRight, SlidersHorizontal } from "lucide-react";
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

interface LeaveBalance {
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  leaveType: { id: string; name: string };
}

interface LeaveHistoryTableProps {
  requests: LeaveRequest[];
  leaveTypes: LeaveTypeOption[];
  balances?: LeaveBalance[];
  userName?: string;
}

const STATUS_ALL = "__all__";

const STATUS_OPTIONS = [
  { value: STATUS_ALL, label: "All" },
  { value: "PENDING_MANAGER", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELLED", label: "Cancelled" },
];

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
  balances = [],
  userName,
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

  const now = new Date();
  const day = now.getDate();
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "long" });
  const firstName = userName?.split(" ")[0] ?? "there";

  const totalUsed = balances.reduce((s, b) => s + b.usedDays, 0);
  const totalAllowance = balances.reduce((s, b) => s + b.totalAllowance, 0);
  const totalPending = balances.reduce((s, b) => s + b.pendingDays, 0);
  const totalRemaining = totalAllowance - totalUsed - totalPending;

  return (
    <>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-foreground/10">
              <span className="text-xl font-bold leading-none">{day}</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-semibold">{weekday},</p>
                <p className="text-xs text-muted-foreground">{month}</p>
              </div>
              <div className="mx-1 h-8 w-px bg-border" />
              <Button
                nativeButton={false}
                render={<Link href="/leaves/new" />}
                className="rounded-full px-5"
              >
                Request Leave <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>

          <div className="sm:text-right">
            <h1 className="text-2xl font-bold tracking-tight">
              Hey, {firstName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your time off
            </p>
          </div>
        </div>

        {/* ── Activity section ── */}
        <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.04)]">
          {/* Activity header */}
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-border/60">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">Leave History</h2>
              <SlidersHorizontal className="size-4 text-muted-foreground" />
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter chips */}
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                  }`}
                >
                  {statusFilter === opt.value && (
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  )}
                  {opt.label}
                  {statusFilter === opt.value && opt.value !== STATUS_ALL && (
                    <X
                      className="size-3 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusFilter(STATUS_ALL);
                      }}
                    />
                  )}
                </button>
              ))}

              {/* Type filter */}
              {leaveTypes.length > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  {leaveTypes.map((lt) => (
                    <button
                      key={lt.id}
                      onClick={() =>
                        setTypeFilter(typeFilter === lt.id ? STATUS_ALL : lt.id)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        typeFilter === lt.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                      }`}
                    >
                      {typeFilter === lt.id && (
                        <span className="size-1.5 rounded-full bg-primary-foreground" />
                      )}
                      {lt.name}
                      {typeFilter === lt.id && (
                        <X
                          className="size-3 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTypeFilter(STATUS_ALL);
                          }}
                        />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Leave Type
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Start
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    End
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium text-center">
                    Days
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Status
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Submitted
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-12"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                          <SlidersHorizontal className="size-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm">No leave requests found</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1 rounded-full"
                          nativeButton={false}
                          render={<Link href="/leaves/new" />}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Request Leave
                        </Button>
                      </div>
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
                        <TableCell className="text-muted-foreground">
                          {formatDate(r.startDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(r.endDate)}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {r.totalDays}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`rounded-full ${badge.className}`}
                          >
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(r.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canCancel && (
                            <button
                              onClick={() => openCancelDialog(r.id)}
                              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="size-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer summary */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length} request{filtered.length !== 1 ? "s" : ""}
              </p>
              {totalRemaining > 0 && (
                <p className="text-xs text-muted-foreground">
                  {totalRemaining} day{totalRemaining !== 1 ? "s" : ""} remaining
                  this year
                </p>
              )}
            </div>
          )}
        </div>
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
