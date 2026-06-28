"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitLeaveRequestAction } from "@/app/(dashboard)/leaves/actions";
import { calculateBusinessDays } from "@/lib/date-utils";

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  leaveType: { id: string; name: string };
}

interface LeaveRequestFormProps {
  balances: LeaveBalance[];
}

export function LeaveRequestForm({ balances }: LeaveRequestFormProps) {
  const router = useRouter();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);
  const remaining = selectedBalance
    ? selectedBalance.totalAllowance - selectedBalance.usedDays - selectedBalance.pendingDays
    : null;

  let businessDays = 0;
  if (startDate && endDate) {
    businessDays = calculateBusinessDays(new Date(startDate), new Date(endDate));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!leaveTypeId) { setError("Please select a leave type"); return; }
    if (!startDate) { setError("Please select a start date"); return; }
    if (!endDate) { setError("Please select an end date"); return; }
    if (new Date(endDate) < new Date(startDate)) { setError("End date must be on or after start date"); return; }
    if (businessDays === 0) { setError("Selected date range contains no business days"); return; }
    if (!reason.trim()) { setError("Please provide a reason"); return; }
    if (remaining !== null && businessDays > remaining) {
      setError(`Insufficient balance. You have ${remaining} day${remaining === 1 ? "" : "s"} remaining`);
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("leaveTypeId", leaveTypeId);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("reason", reason.trim());

    const result = await submitLeaveRequestAction(formData);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }

    router.push("/leaves");
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Request Leave</CardTitle>
        <CardDescription>
          Submit a new leave request for approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="leaveType">Leave Type</Label>
              <Select value={leaveTypeId} onValueChange={(v) => setLeaveTypeId(v ?? "")}>
                <SelectTrigger id="leaveType">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((b) => {
                    const rem = b.totalAllowance - b.usedDays - b.pendingDays;
                    return (
                      <SelectItem key={b.leaveTypeId} value={b.leaveTypeId}>
                        {b.leaveType.name} ({rem} remaining)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
              <p className="text-sm text-muted-foreground">
                {businessDays} business day{businessDays === 1 ? "" : "s"}
                {remaining !== null && (
                  <> &middot; {remaining} day{remaining === 1 ? "" : "s"} remaining</>
                )}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe the reason for your leave"
                rows={3}
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/leaves")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
