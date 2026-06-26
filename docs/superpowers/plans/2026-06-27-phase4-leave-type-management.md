# Phase 4: HR Leave Type Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the HR leave type management page where HR users can create, edit, and toggle leave types, with automatic leave balance creation for department-assigned employees.

**Architecture:** Server Component page fetches leave types via a service layer and passes them to a Client Component table. Mutations use Server Actions (file-level `"use server"`) that delegate to the service layer. The service layer (`leave.service.ts`) owns all Prisma queries and business logic. Modal dialogs (shadcn `Dialog`) handle create/edit forms.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Prisma 7, shadcn/ui, Tailwind CSS, TypeScript

## Global Constraints

- Next.js 16 — read `node_modules/next/dist/docs/` before writing any code; heed deprecation notices (per AGENTS.md)
- Use `revalidatePath` from `next/cache` for cache revalidation after mutations
- Server Actions must verify `auth()` session and check `role === "HR"` before any mutation
- No Zod — straightforward validation checks inline (consistent with Phase 2)
- Prisma client imported as `db` from `@/lib/db`
- All types/enums imported from `@/types/index.ts` which re-exports from generated Prisma client
- shadcn components use `@/components/ui/*` path aliases (configured in `components.json`)
- Form patterns follow Phase 2 conventions: controlled inputs with `useState`, inline error messages with `text-destructive` class
- shadcn style is `base-nova` with `neutral` base color and CSS variables enabled

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/services/leave.service.ts` | Business logic: leave type CRUD, balance auto-creation |
| `src/app/(dashboard)/hr/leave-types/actions.ts` | Server Actions: auth check, validation, delegate to service, revalidate |
| `src/app/(dashboard)/hr/leave-types/page.tsx` | Server Component: auth gate, fetch data, render client table |
| `src/components/leaves/leave-type-table.tsx` | Client Component: table rendering, action buttons, dialog state management |
| `src/components/leaves/leave-type-form-dialog.tsx` | Client Component: create/edit form inside a Dialog |

---

### Task 1: Install shadcn Components

**Files:**
- Create: `src/components/ui/table.tsx` (via shadcn CLI)
- Create: `src/components/ui/dialog.tsx` (via shadcn CLI)
- Create: `src/components/ui/checkbox.tsx` (via shadcn CLI)
- Create: `src/components/ui/textarea.tsx` (via shadcn CLI)
- Create: `src/components/ui/badge.tsx` (via shadcn CLI)

**Interfaces:**
- Consumes: nothing
- Produces: shadcn UI primitives used by Tasks 4 and 5 — `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table`; `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`; `Checkbox` from `@/components/ui/checkbox`; `Textarea` from `@/components/ui/textarea`; `Badge` from `@/components/ui/badge`

- [ ] **Step 1: Install the five shadcn components**

Run each command — they are non-interactive with `--yes`:

```bash
npx shadcn@latest add table --yes
npx shadcn@latest add dialog --yes
npx shadcn@latest add checkbox --yes
npx shadcn@latest add textarea --yes
npx shadcn@latest add badge --yes
```

- [ ] **Step 2: Verify files were created**

```bash
ls src/components/ui/table.tsx src/components/ui/dialog.tsx src/components/ui/checkbox.tsx src/components/ui/textarea.tsx src/components/ui/badge.tsx
```

Expected: all five files exist.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/table.tsx src/components/ui/dialog.tsx src/components/ui/checkbox.tsx src/components/ui/textarea.tsx src/components/ui/badge.tsx
git commit -m "feat(ui): add shadcn table, dialog, checkbox, textarea, badge components"
```

---

### Task 2: Leave Service Layer

**Files:**
- Create: `src/services/leave.service.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`; `LeaveType` type from `@/types/index.ts`
- Produces:
  - `getAllLeaveTypes(): Promise<LeaveType[]>` — returns all leave types ordered by name ascending
  - `createLeaveType(data: { name: string; description: string | null; defaultAllowance: number; isPaid: boolean }): Promise<LeaveType>` — creates leave type + bulk-creates balances for department-assigned users in a transaction
  - `updateLeaveType(id: string, data: { name: string; description: string | null; defaultAllowance: number; isPaid: boolean }): Promise<LeaveType>` — updates leave type fields (does not update existing balances)
  - `toggleLeaveTypeActive(id: string): Promise<LeaveType>` — flips `isActive` field

- [ ] **Step 1: Create the service file with `getAllLeaveTypes`**

```typescript
// src/services/leave.service.ts
import { db } from "@/lib/db";

export async function getAllLeaveTypes() {
  return db.leaveType.findMany({
    orderBy: { name: "asc" },
  });
}
```

- [ ] **Step 2: Add `createLeaveType` with balance auto-creation**

Add this function below `getAllLeaveTypes`:

```typescript
export async function createLeaveType(data: {
  name: string;
  description: string | null;
  defaultAllowance: number;
  isPaid: boolean;
}) {
  return db.$transaction(async (tx) => {
    const leaveType = await tx.leaveType.create({ data });

    const usersWithDepartment = await tx.user.findMany({
      where: { departmentId: { not: null } },
      select: { id: true },
    });

    if (usersWithDepartment.length > 0) {
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.createMany({
        data: usersWithDepartment.map((user) => ({
          userId: user.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
          totalAllowance: data.defaultAllowance,
          usedDays: 0,
          pendingDays: 0,
        })),
      });
    }

    return leaveType;
  });
}
```

- [ ] **Step 3: Add `updateLeaveType`**

Add this function below `createLeaveType`:

```typescript
export async function updateLeaveType(
  id: string,
  data: {
    name: string;
    description: string | null;
    defaultAllowance: number;
    isPaid: boolean;
  }
) {
  return db.leaveType.update({
    where: { id },
    data,
  });
}
```

- [ ] **Step 4: Add `toggleLeaveTypeActive`**

Add this function below `updateLeaveType`:

```typescript
export async function toggleLeaveTypeActive(id: string) {
  const leaveType = await db.leaveType.findUniqueOrThrow({ where: { id } });
  return db.leaveType.update({
    where: { id },
    data: { isActive: !leaveType.isActive },
  });
}
```

- [ ] **Step 5: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/leave.service.ts
git commit -m "feat(services): add leave service with CRUD and balance auto-creation"
```

---

### Task 3: Server Actions

**Files:**
- Create: `src/app/(dashboard)/hr/leave-types/actions.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`; `createLeaveType`, `updateLeaveType`, `toggleLeaveTypeActive` from `@/services/leave.service`; `revalidatePath` from `next/cache`
- Produces:
  - `createLeaveTypeAction(formData: FormData): Promise<{ success: boolean; error?: string }>` — validates input, creates leave type, revalidates
  - `updateLeaveTypeAction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }>` — validates input, updates leave type, revalidates
  - `toggleLeaveTypeActiveAction(id: string): Promise<{ success: boolean; error?: string }>` — toggles active status, revalidates

- [ ] **Step 1: Create the actions file with auth helper and `createLeaveTypeAction`**

```typescript
// src/app/(dashboard)/hr/leave-types/actions.ts
"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createLeaveType,
  updateLeaveType,
  toggleLeaveTypeActive,
} from "@/services/leave.service";

async function requireHR() {
  const session = await auth();
  if (!session || session.user.role !== "HR") {
    return null;
  }
  return session;
}

export async function createLeaveTypeAction(formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const defaultAllowanceRaw = formData.get("defaultAllowance") as string | null;
  const isPaid = formData.get("isPaid") === "on";

  if (!name || !name.trim()) {
    return { success: false, error: "Name is required" };
  }
  const defaultAllowance = Number(defaultAllowanceRaw);
  if (!Number.isInteger(defaultAllowance) || defaultAllowance < 1) {
    return { success: false, error: "Default allowance must be a positive whole number" };
  }

  try {
    await createLeaveType({
      name: name.trim(),
      description: description?.trim() || null,
      defaultAllowance,
      isPaid,
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return { success: false, error: "A leave type with this name already exists" };
    }
    return { success: false, error: "Failed to create leave type" };
  }

  revalidatePath("/hr/leave-types");
  return { success: true };
}
```

- [ ] **Step 2: Add `updateLeaveTypeAction`**

Add below the `createLeaveTypeAction`:

```typescript
export async function updateLeaveTypeAction(id: string, formData: FormData) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string | null) || null;
  const defaultAllowanceRaw = formData.get("defaultAllowance") as string | null;
  const isPaid = formData.get("isPaid") === "on";

  if (!name || !name.trim()) {
    return { success: false, error: "Name is required" };
  }
  const defaultAllowance = Number(defaultAllowanceRaw);
  if (!Number.isInteger(defaultAllowance) || defaultAllowance < 1) {
    return { success: false, error: "Default allowance must be a positive whole number" };
  }

  try {
    await updateLeaveType(id, {
      name: name.trim(),
      description: description?.trim() || null,
      defaultAllowance,
      isPaid,
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return { success: false, error: "A leave type with this name already exists" };
    }
    return { success: false, error: "Failed to update leave type" };
  }

  revalidatePath("/hr/leave-types");
  return { success: true };
}
```

- [ ] **Step 3: Add `toggleLeaveTypeActiveAction`**

Add below the `updateLeaveTypeAction`:

```typescript
export async function toggleLeaveTypeActiveAction(id: string) {
  const session = await requireHR();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await toggleLeaveTypeActive(id);
  } catch {
    return { success: false, error: "Failed to toggle leave type status" };
  }

  revalidatePath("/hr/leave-types");
  return { success: true };
}
```

- [ ] **Step 4: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/hr/leave-types/actions.ts
git commit -m "feat(leave-types): add server actions for create, update, and toggle"
```

---

### Task 4: Leave Type Form Dialog Component

**Files:**
- Create: `src/components/leaves/leave-type-form-dialog.tsx`

**Interfaces:**
- Consumes: `createLeaveTypeAction`, `updateLeaveTypeAction` from `@/app/(dashboard)/hr/leave-types/actions`; shadcn `Dialog`, `Input`, `Label`, `Button`, `Checkbox`, `Textarea` components
- Produces: `LeaveTypeFormDialog` component with props:
  - `open: boolean` — controls dialog visibility
  - `onOpenChange: (open: boolean) => void` — called when dialog should open/close
  - `leaveType?: { id: string; name: string; description: string | null; defaultAllowance: number; isPaid: boolean } | null` — if provided, dialog is in edit mode with pre-filled values; if null/undefined, dialog is in create mode

- [ ] **Step 1: Create the form dialog component**

```tsx
// src/components/leaves/leave-type-form-dialog.tsx
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
```

- [ ] **Step 2: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/leaves/leave-type-form-dialog.tsx
git commit -m "feat(leave-types): add create/edit form dialog component"
```

---

### Task 5: Leave Type Table Component

**Files:**
- Create: `src/components/leaves/leave-type-table.tsx`

**Interfaces:**
- Consumes: `toggleLeaveTypeActiveAction` from `@/app/(dashboard)/hr/leave-types/actions`; `LeaveTypeFormDialog` from `@/components/leaves/leave-type-form-dialog`; shadcn `Table`, `Badge`, `Button` components; `LeaveType` type from `@/types/index.ts`
- Produces: `LeaveTypeTable` component with props:
  - `leaveTypes: LeaveType[]` — the list of leave types to render

- [ ] **Step 1: Create the table component**

```tsx
// src/components/leaves/leave-type-table.tsx
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
```

- [ ] **Step 2: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/leaves/leave-type-table.tsx
git commit -m "feat(leave-types): add leave type table component with edit and toggle actions"
```

---

### Task 6: Leave Types Page

**Files:**
- Create: `src/app/(dashboard)/hr/leave-types/page.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`; `getAllLeaveTypes` from `@/services/leave.service`; `LeaveTypeTable` from `@/components/leaves/leave-type-table`; `redirect` from `next/navigation`
- Produces: the `/hr/leave-types` route — a Server Component page

- [ ] **Step 1: Create the page**

```tsx
// src/app/(dashboard)/hr/leave-types/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllLeaveTypes } from "@/services/leave.service";
import { LeaveTypeTable } from "@/components/leaves/leave-type-table";

export default async function LeaveTypesPage() {
  const session = await auth();
  if (!session || session.user.role !== "HR") redirect("/dashboard");

  const leaveTypes = await getAllLeaveTypes();

  return <LeaveTypeTable leaveTypes={leaveTypes} />;
}
```

- [ ] **Step 2: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/hr/leave-types/page.tsx
git commit -m "feat(leave-types): add HR leave types management page"
```

---

### Task 7: Manual Verification

**Files:** none (testing only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test as HR user**

1. Open `http://localhost:3000` in the browser
2. Login as `admin@company.com` / `admin123`
3. Click "Leave Types" in the sidebar
4. Verify the 4 seeded leave types appear in the table (Annual Leave, Personal Leave, Sick Leave, Unpaid Leave)
5. Click "Create Leave Type" — fill in name "Bereavement Leave", allowance 5, check Paid → submit → verify it appears in the table
6. Try creating another "Bereavement Leave" → verify duplicate error message appears
7. Click Edit (pencil icon) on a leave type → change description → save → verify table updates
8. Click Toggle on an active type → verify badge changes to Inactive (gray)
9. Click Toggle again → verify badge changes back to Active (green)

- [ ] **Step 3: Test authorization**

1. Register a new employee account at `/register`
2. Login as that employee
3. Navigate directly to `/hr/leave-types` in the browser URL bar
4. Verify you are redirected to `/dashboard`

- [ ] **Step 4: Verify balance auto-creation in the database**

After creating a leave type as HR, check the database for balance records. If there are users assigned to departments, verify `leave_balances` rows were created. (Since the seed only creates an HR user with no department, balances won't be auto-created with seed data alone — this is correct per the design. Balance creation will be fully testable after Phase 5 adds department/user management.)

- [ ] **Step 5: Commit any fixes if needed**

If any issues were found during testing, fix them and commit:

```bash
git add -A
git commit -m "fix(leave-types): address issues found during manual testing"
```
