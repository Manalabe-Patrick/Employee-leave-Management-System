"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ApprovalRequest {
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

interface ApprovalCardProps {
  request: ApprovalRequest;
  onApprove: (
    requestId: string,
    comment: string
  ) => Promise<{ success: boolean; error?: string }>;
  onDecline: (
    requestId: string,
    comment: string
  ) => Promise<{ success: boolean; error?: string }>;
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ApprovalCard({
  request,
  onApprove,
  onDecline,
}: ApprovalCardProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function handleAction(action: "approve" | "decline") {
    setLoading(action);
    setError("");

    const handler = action === "approve" ? onApprove : onDecline;
    const result = await handler(request.id, comment.trim());

    if (!result.success) {
      setError(result.error || `Failed to ${action} request`);
      setLoading(null);
      return;
    }

    setLoading(null);
  }

  const fullName = `${request.user.firstName} ${request.user.lastName}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {request.user.email}
              {request.departmentName && ` · ${request.departmentName}`}
            </p>
          </div>
          <Badge variant="secondary">
            {request.leaveType.name} · {request.totalDays} day
            {request.totalDays === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <span className="font-medium">
            {formatDate(request.startDate)} – {formatDate(request.endDate)}
          </span>
          <span className="text-muted-foreground ml-2">
            · Submitted {formatDate(request.createdAt)}
          </span>
        </div>
        <div className="text-sm">
          <span className="font-medium">Reason: </span>
          {request.reason}
        </div>
        <Textarea
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          disabled={loading !== null}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="destructive"
          onClick={() => handleAction("decline")}
          disabled={loading !== null}
        >
          {loading === "decline" ? "Declining..." : "Decline"}
        </Button>
        <Button
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
        >
          {loading === "approve" ? "Approving..." : "Approve"}
        </Button>
      </CardFooter>
    </Card>
  );
}
