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
import { Pencil } from "lucide-react";
import { UserEditDialog } from "@/components/users/user-edit-dialog";

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId: string | null;
  department: { id: string; name: string } | null;
}

interface UserTableProps {
  users: UserRow[];
  departments: { id: string; name: string }[];
}

const roleBadgeClasses: Record<string, string> = {
  HR: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  MANAGER: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  EMPLOYEE: "bg-gray-100 text-gray-700 hover:bg-gray-100",
};

export function UserTable({ users, departments }: UserTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  function handleEdit(user: UserRow) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Users</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={roleBadgeClasses[user.role] || ""}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.department?.name || (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <UserEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        departments={departments}
      />
    </>
  );
}
