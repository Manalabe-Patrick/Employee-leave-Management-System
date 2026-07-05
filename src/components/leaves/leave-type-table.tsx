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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-semibold">Leave Types</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage leave categories and allowances
            </p>
          </div>
          <Button onClick={handleCreate} className="rounded-full px-5">
            <Plus className="mr-2 h-4 w-4" />
            Create Leave Type
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="border-t bg-muted/30 hover:bg-muted/30">
                <TableHead className="px-6">Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Allowance</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    No leave types found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                leaveTypes.map((lt) => (
                  <TableRow key={lt.id} className="border-b-0 border-t">
                    <TableCell className="font-medium px-6">{lt.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lt.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{lt.defaultAllowance}</span>
                      <span className="text-muted-foreground ml-1">days</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={lt.isPaid ? "default" : "outline"}
                        className="rounded-full px-3"
                      >
                        {lt.isPaid ? "Paid" : "Unpaid"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={lt.isActive ? "default" : "secondary"}
                        className={`rounded-full px-3 ${
                          lt.isActive
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        {lt.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(lt)}
                          className="rounded-full"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleToggle(lt.id)}
                          disabled={togglingId === lt.id}
                          className="rounded-full"
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
        </CardContent>
      </Card>

      <LeaveTypeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leaveType={editingType}
      />
    </>
  );
}
