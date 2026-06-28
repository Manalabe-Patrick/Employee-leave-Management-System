"use client";

import { Badge } from "@/components/ui/badge";
import { ApprovalCard } from "@/components/leaves/approval-card";
import { hrApproveAction, hrDeclineAction } from "./actions";

interface LeaveRequest {
  id: string;
  totalDays: number;
  reason: string;
  startDate: string | Date;
  endDate: string | Date;
  createdAt: string | Date;
  user: { firstName: string; lastName: string; email: string };
  leaveType: { name: string };
  departmentName?: string;
}

interface HRApprovalsListProps {
  requests: LeaveRequest[];
}

export function HRApprovalsList({ requests }: HRApprovalsListProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">HR Approvals</h1>
        <Badge variant="secondary">{requests.length}</Badge>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground">
          No pending requests to review.
        </p>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {requests.map((request) => (
            <ApprovalCard
              key={request.id}
              request={request}
              onApprove={hrApproveAction}
              onDecline={hrDeclineAction}
            />
          ))}
        </div>
      )}
    </>
  );
}
