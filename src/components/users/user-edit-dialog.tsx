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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateUserDepartmentAction,
  updateUserRoleAction,
} from "@/app/(dashboard)/hr/users/actions";

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    departmentId: string | null;
  } | null;
  departments: { id: string; name: string }[];
}

const UNASSIGNED = "__unassigned__";

export function UserEditDialog({
  open,
  onOpenChange,
  user,
  departments,
}: UserEditDialogProps) {
  const [departmentId, setDepartmentId] = useState(UNASSIGNED);
  const [role, setRole] = useState("EMPLOYEE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setDepartmentId(user.departmentId || UNASSIGNED);
      setRole(user.role);
      setError("");
    }
  }, [open, user]);

  if (!user) return null;

  const isManager = user.role === "MANAGER";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const newDeptId = departmentId === UNASSIGNED ? null : departmentId;
    const deptChanged = newDeptId !== user!.departmentId;
    const roleChanged = role !== user!.role;

    try {
      if (deptChanged) {
        const result = await updateUserDepartmentAction(user!.id, newDeptId);
        if (!result.success) {
          setError(result.error || "Failed to update department");
          setLoading(false);
          return;
        }
      }

      if (roleChanged && !isManager) {
        const result = await updateUserRoleAction(user!.id, role);
        if (!result.success) {
          setError(result.error || "Failed to update role");
          setLoading(false);
          return;
        }
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update department assignment and role for this user.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-department">Department</Label>
              {isManager ? (
                <div>
                  <p className="text-sm font-medium">
                    {departments.find((d) => d.id === user.departmentId)?.name || "Unassigned"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Set via department assignment
                  </p>
                </div>
              ) : (
                <Select value={departmentId} onValueChange={(value) => value !== null && setDepartmentId(value)}>
                  <SelectTrigger id="user-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              {isManager ? (
                <div>
                  <p className="text-sm font-medium">MANAGER</p>
                  <p className="text-xs text-muted-foreground">
                    Set via department assignment
                  </p>
                </div>
              ) : (
                <Select value={role} onValueChange={(value) => value !== null && setRole(value)}>
                  <SelectTrigger id="user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
