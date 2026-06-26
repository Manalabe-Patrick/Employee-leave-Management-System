"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  createLeaveTypeAction,
  updateLeaveTypeAction,
} from "@/app/(dashboard)/hr/leave-types/actions";

interface LeaveTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveType?: {
    id: string;
    name: string;
    description: string | null;
    defaultAllowance: number;
    isPaid: boolean;
  } | null;
}

export function LeaveTypeFormDialog({
  open,
  onOpenChange,
  leaveType,
}: LeaveTypeFormDialogProps) {
  const isEditing = !!leaveType;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultAllowance, setDefaultAllowance] = useState("1");
  const [isPaid, setIsPaid] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (leaveType) {
        setName(leaveType.name);
        setDescription(leaveType.description || "");
        setDefaultAllowance(String(leaveType.defaultAllowance));
        setIsPaid(leaveType.isPaid);
      } else {
        setName("");
        setDescription("");
        setDefaultAllowance("1");
        setIsPaid(true);
      }
      setError("");
    }
  }, [open, leaveType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("defaultAllowance", defaultAllowance);
    if (isPaid) formData.set("isPaid", "on");

    const result = isEditing
      ? await updateLeaveTypeAction(leaveType!.id, formData)
      : await createLeaveTypeAction(formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Leave Type" : "Create Leave Type"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the leave type details below."
              : "Fill in the details to create a new leave type."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="lt-name">Name</Label>
              <Input
                id="lt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Annual Leave"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lt-description">Description</Label>
              <Textarea
                id="lt-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lt-allowance">Default Allowance (days)</Label>
              <Input
                id="lt-allowance"
                type="number"
                min={1}
                step={1}
                value={defaultAllowance}
                onChange={(e) => setDefaultAllowance(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="lt-isPaid"
                checked={isPaid}
                onCheckedChange={(checked) => setIsPaid(checked === true)}
              />
              <Label htmlFor="lt-isPaid" className="font-normal">
                Paid leave
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
