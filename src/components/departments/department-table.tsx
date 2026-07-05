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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Plus } from "lucide-react";
import { deleteDepartmentAction } from "@/app/(dashboard)/hr/departments/actions";
import { DepartmentFormDialog } from "@/components/departments/department-form-dialog";

interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  managerId: string;
  manager: { id: string; firstName: string; lastName: string; email: string };
  _count: { employees: number };
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface DepartmentTableProps {
  departments: DepartmentRow[];
  users: UserOption[];
}

export function DepartmentTable({ departments, users }: DepartmentTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleCreate() {
    setEditingDept(null);
    setDialogOpen(true);
  }

  function handleEdit(dept: DepartmentRow) {
    setEditingDept(dept);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    const result = await deleteDepartmentAction(id);
    setDeletingId(null);
    if (!result.success) {
      setDeleteError(result.error || "Failed to delete");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-semibold">Departments</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage organization departments and managers
            </p>
          </div>
          <Button onClick={handleCreate} className="rounded-full px-5">
            <Plus className="mr-2 h-4 w-4" />
            Create Department
          </Button>
        </CardHeader>

        {deleteError && (
          <div className="px-6 pb-2">
            <p className="text-sm text-destructive">{deleteError}</p>
          </div>
        )}

        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="border-t bg-muted/30 hover:bg-muted/30">
                <TableHead className="px-6">Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-center">Employees</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No departments found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => (
                  <TableRow key={dept.id} className="border-b-0 border-t">
                    <TableCell className="font-medium px-6">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dept.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{dept.manager.firstName} {dept.manager.lastName}</div>
                      <div className="text-xs text-muted-foreground">{dept.manager.email}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {dept._count.employees}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(dept)}
                          className="rounded-full"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(dept.id)}
                          disabled={dept._count.employees > 1 || deletingId === dept.id}
                          title={
                            dept._count.employees > 1
                              ? "Remove all employees before deleting"
                              : "Delete department"
                          }
                          className="rounded-full"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <DepartmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={editingDept}
        users={users}
      />
    </>
  );
}
