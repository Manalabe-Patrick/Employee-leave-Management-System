# Phase 5: HR Department & User Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR create/edit/delete departments, assign managers, manage users (role changes, department assignments), with automatic leave balance creation on department assignment.

**Architecture:** Server actions + service layer (same pattern as Phase 4). Server components fetch data via Prisma, client components handle interactive tables/dialogs. No API routes.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 7, shadcn/ui, TypeScript, Tailwind CSS

## Global Constraints

- Follow existing Phase 4 patterns exactly (service → server action → client component)
- `"use server"` directive at top of action files
- `PrismaClientKnownRequestError` imported from `@/generated/prisma/internal/prismaNamespace`
- Auth check via `auth()` from `@/lib/auth`, session shape: `session.user.role`, `session.user.userId`
- All server actions return `{ success: boolean; error?: string }`
- `revalidatePath()` after mutations
- shadcn/ui `<Select>` component must be installed before use (not yet in the project)
- Re-export any new types needed from `@/types/index.ts` using Prisma generated types
- Next.js 16: check `node_modules/next/dist/docs/` if unsure about any API

---

### Task 1: Install shadcn Select Component

Both the department form and user edit dialog need a `<Select>` dropdown. This component is not yet installed.

**Files:**
- Create: `src/components/ui/select.tsx`

**Interfaces:**
- Produces: `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` components importable from `@/components/ui/select`

- [ ] **Step 1: Install the shadcn select component**

Run:
```bash
npx shadcn@latest add select
```

Expected: creates `src/components/ui/select.tsx` with all Select sub-components.

- [ ] **Step 2: Verify the file exists**

Run:
```bash
ls src/components/ui/select.tsx
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "feat(ui): add shadcn select component"
```

---

### Task 2: Department Service

**Files:**
- Create: `src/services/department.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces:
  - `getAllDepartments(): Promise<DepartmentWithDetails[]>` where `DepartmentWithDetails = { id: string; name: string; description: string | null; managerId: string; createdAt: Date; manager: { id: string; firstName: string; lastName: string; email: string }; _count: { employees: number } }`
  - `createDepartment(data: { name: string; description: string | null; managerId: string }): Promise<Department>`
  - `updateDepartment(id: string, data: { name: string; description: string | null; managerId: string }): Promise<Department>`
  - `deleteDepartment(id: string): Promise<Department>`

- [ ] **Step 1: Create department service with `getAllDepartments`**

Create `src/services/department.service.ts`:

```typescript
import { db } from "@/lib/db";

export async function getAllDepartments() {
  return db.department.findMany({
    include: {
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });
}
```

- [ ] **Step 2: Add `createDepartment`**

Append to `src/services/department.service.ts`:

```typescript
export async function createDepartment(data: {
  name: string;
  description: string | null;
  managerId: string;
}) {
  return db.$transaction(async (tx) => {
    const department = await tx.department.create({
      data: {
        name: data.name,
        description: data.description,
        managerId: data.managerId,
      },
    });

    await tx.user.update({
      where: { id: data.managerId },
      data: { role: "MANAGER", departmentId: department.id },
    });

    return department;
  });
}
```

- [ ] **Step 3: Add `updateDepartment`**

Append to `src/services/department.service.ts`:

```typescript
export async function updateDepartment(
  id: string,
  data: {
    name: string;
    description: string | null;
    managerId: string;
  }
) {
  return db.$transaction(async (tx) => {
    const current = await tx.department.findUniqueOrThrow({
      where: { id },
      select: { managerId: true },
    });

    const department = await tx.department.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        managerId: data.managerId,
      },
    });

    if (current.managerId !== data.managerId) {
      const oldManager = await tx.user.findUniqueOrThrow({
        where: { id: current.managerId },
        select: { role: true },
      });
      if (oldManager.role !== "HR") {
        await tx.user.update({
          where: { id: current.managerId },
          data: { role: "EMPLOYEE" },
        });
      }

      await tx.user.update({
        where: { id: data.managerId },
        data: { role: "MANAGER", departmentId: department.id },
      });
    }

    return department;
  });
}
```

- [ ] **Step 4: Add `deleteDepartment`**

Append to `src/services/department.service.ts`:

```typescript
export async function deleteDepartment(id: string) {
  return db.$transaction(async (tx) => {
    const department = await tx.department.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });

    if (department._count.employees > 0) {
      throw new Error("DEPARTMENT_HAS_EMPLOYEES");
    }

    const manager = await tx.user.findUniqueOrThrow({
      where: { id: department.managerId },
      select: { role: true },
    });

    await tx.department.delete({ where: { id } });

    if (manager.role !== "HR") {
      await tx.user.update({
        where: { id: department.managerId },
        data: { role: "EMPLOYEE" },
      });
    }

    return department;
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors in `department.service.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/services/department.service.ts
git commit -m "feat(services): add department service with CRUD and manager role logic"
```

---

### Task 3: User Service

**Files:**
- Create: `src/services/user.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces:
  - `getAllUsers(): Promise<UserWithDepartment[]>` where `UserWithDepartment = { id: string; email: string; firstName: string; lastName: string; role: Role; departmentId: string | null; createdAt: Date; department: { id: string; name: string } | null }`
  - `updateUserDepartment(userId: string, departmentId: string): Promise<User>`
  - `unassignUserDepartment(userId: string): Promise<User>`
  - `updateUserRole(userId: string, role: "HR" | "EMPLOYEE"): Promise<User>`

- [ ] **Step 1: Create user service with `getAllUsers`**

Create `src/services/user.service.ts`:

```typescript
import { db } from "@/lib/db";

export async function getAllUsers() {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      departmentId: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { firstName: "asc" },
  });
}
```

- [ ] **Step 2: Add `updateUserDepartment` with balance auto-creation**

Append to `src/services/user.service.ts`:

```typescript
export async function updateUserDepartment(
  userId: string,
  departmentId: string
) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { departmentId },
    });

    const activeLeaveTypes = await tx.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, defaultAllowance: true },
    });

    if (activeLeaveTypes.length > 0) {
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.createMany({
        data: activeLeaveTypes.map((lt) => ({
          userId,
          leaveTypeId: lt.id,
          year: currentYear,
          totalAllowance: lt.defaultAllowance,
        })),
        skipDuplicates: true,
      });
    }

    return user;
  });
}
```

- [ ] **Step 3: Add `unassignUserDepartment`**

Append to `src/services/user.service.ts`:

```typescript
export async function unassignUserDepartment(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { departmentId: null },
  });
}
```

- [ ] **Step 4: Add `updateUserRole`**

Append to `src/services/user.service.ts`:

```typescript
export async function updateUserRole(
  userId: string,
  role: "HR" | "EMPLOYEE"
) {
  return db.user.update({
    where: { id: userId },
    data: { role },
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors in `user.service.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/services/user.service.ts
git commit -m "feat(services): add user service with department assignment and balance auto-creation"
```

---

### Task 4: Department Server Actions

**Files:**
- Create: `src/app/(dashboard)/hr/departments/actions.ts`

**Interfaces:**
- Consumes: `createDepartment`, `updateDepartment`, `deleteDepartment` from `@/services/department.service`; `auth` from `@/lib/auth`; `PrismaClientKnownRequestError` from `@/generated/prisma/internal/prismaNamespace`
- Produces:
  - `createDepartmentAction(formData: FormData): Promise<{ success: boolean; error?: string }>`
  - `updateDepartmentAction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }>`
  - `deleteDepartmentAction(id: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Create department actions file with auth helper and `createDepartmentAction`**

Create `src/app/(dashboard)/hr/departments/actions.ts`:

```typescript
"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/services/department.service";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") {
    return null;
  }
  return session;
}

export async function createDepartmentAction(formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const managerId = formData.get("managerId") as string | null;

  if (!name || !name.trim()) {
    return { success: false, error: "Department name is required" };
  }
  if (!managerId) {
    return { success: false, error: "Manager is required" };
  }

  try {
    await createDepartment({
      name: name.trim(),
      description: description?.trim() || null,
      managerId,
    });
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes("managerId")) {
        return { success: false, error: "This user already manages another department" };
      }
      return { success: false, error: "A department with this name already exists" };
    }
    return { success: false, error: "Failed to create department" };
  }

  revalidatePath("/hr/departments");
  return { success: true };
}
```

- [ ] **Step 2: Add `updateDepartmentAction`**

Append to the same file:

```typescript
export async function updateDepartmentAction(id: string, formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const managerId = formData.get("managerId") as string | null;

  if (!name || !name.trim()) {
    return { success: false, error: "Department name is required" };
  }
  if (!managerId) {
    return { success: false, error: "Manager is required" };
  }

  try {
    await updateDepartment(id, {
      name: name.trim(),
      description: description?.trim() || null,
      managerId,
    });
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes("managerId")) {
        return { success: false, error: "This user already manages another department" };
      }
      return { success: false, error: "A department with this name already exists" };
    }
    return { success: false, error: "Failed to update department" };
  }

  revalidatePath("/hr/departments");
  return { success: true };
}
```

- [ ] **Step 3: Add `deleteDepartmentAction`**

Append to the same file:

```typescript
export async function deleteDepartmentAction(id: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await deleteDepartment(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "DEPARTMENT_HAS_EMPLOYEES") {
      return { success: false, error: "Cannot delete a department that has employees assigned" };
    }
    return { success: false, error: "Failed to delete department" };
  }

  revalidatePath("/hr/departments");
  return { success: true };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/hr/departments/actions.ts
git commit -m "feat(departments): add server actions for create, update, and delete"
```

---

### Task 5: User Server Actions

**Files:**
- Create: `src/app/(dashboard)/hr/users/actions.ts`

**Interfaces:**
- Consumes: `updateUserDepartment`, `unassignUserDepartment`, `updateUserRole` from `@/services/user.service`; `auth` from `@/lib/auth`
- Produces:
  - `updateUserDepartmentAction(userId: string, departmentId: string | null): Promise<{ success: boolean; error?: string }>`
  - `updateUserRoleAction(userId: string, role: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Create user actions file**

Create `src/app/(dashboard)/hr/users/actions.ts`:

```typescript
"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  updateUserDepartment,
  unassignUserDepartment,
  updateUserRole,
} from "@/services/user.service";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") {
    return null;
  }
  return session;
}

export async function updateUserDepartmentAction(
  userId: string,
  departmentId: string | null
) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    if (departmentId) {
      await updateUserDepartment(userId, departmentId);
    } else {
      await unassignUserDepartment(userId);
    }
  } catch {
    return { success: false, error: "Failed to update department assignment" };
  }

  revalidatePath("/hr/users");
  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  if (role !== "HR" && role !== "EMPLOYEE") {
    return { success: false, error: "Role must be HR or EMPLOYEE" };
  }

  try {
    await updateUserRole(userId, role);
  } catch {
    return { success: false, error: "Failed to update user role" };
  }

  revalidatePath("/hr/users");
  return { success: true };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/hr/users/actions.ts
git commit -m "feat(users): add server actions for department assignment and role changes"
```

---

### Task 6: Department Form Dialog Component

**Files:**
- Create: `src/components/departments/department-form-dialog.tsx`

**Interfaces:**
- Consumes: `createDepartmentAction`, `updateDepartmentAction` from `@/app/(dashboard)/hr/departments/actions`; shadcn `Dialog`, `Input`, `Textarea`, `Select`, `Button`, `Label` components
- Produces: `DepartmentFormDialog` component with props:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `department?: { id: string; name: string; description: string | null; managerId: string } | null`
  - `users: { id: string; firstName: string; lastName: string; email: string }[]`

- [ ] **Step 1: Create the department form dialog**

Create `src/components/departments/department-form-dialog.tsx`:

```tsx
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDepartmentAction,
  updateDepartmentAction,
} from "@/app/(dashboard)/hr/departments/actions";

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: {
    id: string;
    name: string;
    description: string | null;
    managerId: string;
  } | null;
  users: { id: string; firstName: string; lastName: string; email: string }[];
}

export function DepartmentFormDialog({
  open,
  onOpenChange,
  department,
  users,
}: DepartmentFormDialogProps) {
  const isEditing = !!department;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (department) {
        setName(department.name);
        setDescription(department.description || "");
        setManagerId(department.managerId);
      } else {
        setName("");
        setDescription("");
        setManagerId("");
      }
      setError("");
    }
  }, [open, department]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("managerId", managerId);

    const result = isEditing
      ? await updateDepartmentAction(department!.id, formData)
      : await createDepartmentAction(formData);

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
            {isEditing ? "Edit Department" : "Create Department"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the department details below."
              : "Fill in the details to create a new department."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-description">Description</Label>
              <Textarea
                id="dept-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-manager">Manager</Label>
              <Select value={managerId} onValueChange={setManagerId} required>
                <SelectTrigger id="dept-manager">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={loading || !managerId}>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/departments/department-form-dialog.tsx
git commit -m "feat(departments): add create/edit form dialog component"
```

---

### Task 7: Department Table Component and Page

**Files:**
- Create: `src/components/departments/department-table.tsx`
- Create: `src/app/(dashboard)/hr/departments/page.tsx`

**Interfaces:**
- Consumes: `DepartmentFormDialog` from `@/components/departments/department-form-dialog`; `deleteDepartmentAction` from `@/app/(dashboard)/hr/departments/actions`; `getAllDepartments` from `@/services/department.service`; `getAllUsers` from `@/services/user.service`
- Produces: `/hr/departments` page rendering a `DepartmentTable` with create/edit/delete functionality

- [ ] **Step 1: Create department table component**

Create `src/components/departments/department-table.tsx`:

```tsx
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
```

- [ ] **Step 2: Create the departments page**

Create `src/app/(dashboard)/hr/departments/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllDepartments } from "@/services/department.service";
import { getAllUsers } from "@/services/user.service";
import { DepartmentTable } from "@/components/departments/department-table";

export default async function DepartmentsPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const [departments, users] = await Promise.all([
    getAllDepartments(),
    getAllUsers(),
  ]);

  return (
    <DepartmentTable
      departments={departments}
      users={users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
      }))}
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/departments/department-table.tsx src/app/(dashboard)/hr/departments/page.tsx
git commit -m "feat(departments): add department table component and HR departments page"
```

---

### Task 8: User Edit Dialog Component

**Files:**
- Create: `src/components/users/user-edit-dialog.tsx`

**Interfaces:**
- Consumes: `updateUserDepartmentAction`, `updateUserRoleAction` from `@/app/(dashboard)/hr/users/actions`; shadcn `Dialog`, `Select`, `Button`, `Label` components
- Produces: `UserEditDialog` component with props:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `user: { id: string; firstName: string; lastName: string; email: string; role: string; departmentId: string | null } | null`
  - `departments: { id: string; name: string }[]`

- [ ] **Step 1: Create the user edit dialog**

Create `src/components/users/user-edit-dialog.tsx`:

```tsx
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
              <Select value={departmentId} onValueChange={setDepartmentId}>
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
                <Select value={role} onValueChange={setRole}>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/users/user-edit-dialog.tsx
git commit -m "feat(users): add user edit dialog component"
```

---

### Task 9: User Table Component and Page

**Files:**
- Create: `src/components/users/user-table.tsx`
- Create: `src/app/(dashboard)/hr/users/page.tsx`

**Interfaces:**
- Consumes: `UserEditDialog` from `@/components/users/user-edit-dialog`; `getAllUsers` from `@/services/user.service`; `getAllDepartments` from `@/services/department.service`
- Produces: `/hr/users` page rendering a `UserTable` with edit functionality

- [ ] **Step 1: Create user table component**

Create `src/components/users/user-table.tsx`:

```tsx
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
```

- [ ] **Step 2: Create the users page**

Create `src/app/(dashboard)/hr/users/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllUsers } from "@/services/user.service";
import { getAllDepartments } from "@/services/department.service";
import { UserTable } from "@/components/users/user-table";

export default async function UsersPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const [users, departments] = await Promise.all([
    getAllUsers(),
    getAllDepartments(),
  ]);

  return (
    <UserTable
      users={users}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/users/user-table.tsx src/app/(dashboard)/hr/users/page.tsx
git commit -m "feat(users): add user table component and HR users page"
```

---

### Task 10: Manual Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run:
```bash
npm run dev
```

Expected: server starts without errors.

- [ ] **Step 2: Log in as the HR user**

Open `http://localhost:3000/login` and log in with the seeded HR account.

- [ ] **Step 3: Test department creation**

Navigate to `/hr/departments`. Click "Create Department". Fill in:
- Name: "Engineering"
- Description: "Software engineering team"
- Manager: select any existing user from the dropdown

Click "Create". Verify:
- Department appears in the table
- Manager column shows the selected user's name and email
- Employee count is 0

- [ ] **Step 4: Test department editing**

Click the edit (pencil) icon on "Engineering". Change the manager to a different user. Click "Save Changes". Verify:
- Manager column updates
- Old manager's role should now be EMPLOYEE (verify via Users page)
- New manager's role should be MANAGER

- [ ] **Step 5: Test duplicate name error**

Create another department. Use the same name "Engineering". Verify:
- Error message "A department with this name already exists" appears
- Dialog stays open

- [ ] **Step 6: Test department deletion guard**

Navigate to `/hr/users`. Assign an employee to "Engineering". Go back to `/hr/departments`. Verify:
- Employee count shows > 0
- Delete button is disabled with tooltip "Remove all employees before deleting"

- [ ] **Step 7: Test user department assignment**

Navigate to `/hr/users`. Click edit on an employee. Select "Engineering" as department. Click "Save Changes". Verify:
- Department column updates to "Engineering"
- (Leave balances are auto-created — verify in a future phase or via database)

- [ ] **Step 8: Test user role change**

Click edit on an EMPLOYEE user. Change role to "HR". Click "Save Changes". Verify:
- Role badge updates to "HR" with purple styling

- [ ] **Step 9: Test MANAGER role is read-only**

Click edit on a user who is currently a MANAGER. Verify:
- Role field shows "MANAGER" as text, not a dropdown
- Note "Set via department assignment" appears below

- [ ] **Step 10: Test department deletion success**

Unassign all employees from a department (set their department to "Unassigned" via Users page). Go to Departments page. Click delete on the now-empty department. Verify:
- Department is removed from the table
- Former manager's role is demoted to EMPLOYEE (verify on Users page)

- [ ] **Step 11: Commit any fixes**

If any fixes were needed during testing, commit them:
```bash
git add -A
git commit -m "fix(phase5): address issues found during manual verification"
```
