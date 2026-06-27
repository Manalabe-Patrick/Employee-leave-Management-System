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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Departments</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Department
        </Button>
      </div>

      {deleteError && (
        <p className="text-sm text-destructive mb-4">{deleteError}</p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-center">Employees</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No departments found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dept.description || "—"}
                  </TableCell>
                  <TableCell>
                    <div>{dept.manager.firstName} {dept.manager.lastName}</div>
                    <div className="text-xs text-muted-foreground">{dept.manager.email}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    {dept._count.employees}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(dept)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(dept.id)}
                        disabled={dept._count.employees > 0 || deletingId === dept.id}
                        title={
                          dept._count.employees > 0
                            ? "Remove all employees before deleting"
                            : "Delete department"
                        }
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
      </div>

      <DepartmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={editingDept}
        users={users}
      />
    </>
  );
}
