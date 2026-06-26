"use client";

import { useState } from "react";
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
import { Pencil, ToggleLeft, ToggleRight, Plus } from "lucide-react";
import { toggleLeaveTypeActiveAction } from "@/app/(dashboard)/hr/leave-types/actions";
import { LeaveTypeFormDialog } from "@/components/leaves/leave-type-form-dialog";
import type { LeaveType } from "@/types/index";

interface LeaveTypeTableProps {
  leaveTypes: LeaveType[];
}

export function LeaveTypeTable({ leaveTypes }: LeaveTypeTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function handleCreate() {
    setEditingType(null);
    setDialogOpen(true);
  }

  function handleEdit(leaveType: LeaveType) {
    setEditingType(leaveType);
    setDialogOpen(true);
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    await toggleLeaveTypeActiveAction(id);
    setTogglingId(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Leave Types</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Leave Type
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Allowance</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No leave types found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              leaveTypes.map((lt) => (
                <TableRow key={lt.id}>
                  <TableCell className="font-medium">{lt.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lt.description || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {lt.defaultAllowance} days
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={lt.isPaid ? "default" : "outline"}>
                      {lt.isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={lt.isActive ? "default" : "secondary"}
                      className={
                        lt.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                      }
                    >
                      {lt.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(lt)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(lt.id)}
                        disabled={togglingId === lt.id}
                      >
                        {lt.isActive ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LeaveTypeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leaveType={editingType}
      />
    </>
  );
}
