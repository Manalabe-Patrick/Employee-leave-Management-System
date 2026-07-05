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
  HR: "bg-purple-100 text-purple-700 hover:bg-purple-100 rounded-full px-3",
  MANAGER: "bg-blue-100 text-blue-700 hover:bg-blue-100 rounded-full px-3",
  EMPLOYEE: "bg-gray-100 text-gray-700 hover:bg-gray-100 rounded-full px-3",
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
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-semibold">Users</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage user accounts
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="border-t bg-muted/30 hover:bg-muted/30">
                <TableHead className="px-6">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="border-b-0 border-t">
                    <TableCell className="font-medium px-6">
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
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(user)}
                        className="rounded-full"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        departments={departments}
      />
    </>
  );
}
