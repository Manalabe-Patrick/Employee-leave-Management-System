# Employee Leave Management System — Master Implementation Plan

**Goal:** Build a complete leave management system with Next.js, PostgreSQL, Prisma, and NextAuth.js.

**Spec:** `docs/superpowers/specs/2026-06-25-employee-leave-management-system-design.md`

**Approach:** Each phase is self-contained and produces a working, testable feature. Implement one phase per session to keep token usage low. Phases must be done in order — each builds on the previous.

## Tech Stack

- Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- PostgreSQL, Prisma ORM
- NextAuth.js (Credentials, JWT), bcrypt
- Resend (email)

---

## Phase 1: Project Setup & Database

**What:** Initialize Next.js project, install all dependencies, write Prisma schema with all models, seed database with demo data.

**Produces:**
- Next.js project scaffold with Tailwind + shadcn/ui configured
- Complete Prisma schema (User, Department, LeaveType, LeaveBalance, LeaveRequest, Notification)
- Seed script with default HR user + sample leave types
- Working `prisma db push` + `prisma db seed`

**Files:**
- `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`
- `prisma/schema.prisma`, `prisma/seed.ts`
- `src/lib/db.ts` (Prisma client singleton)
- `src/types/index.ts` (shared TypeScript types/enums)

**Test:** Run `npx prisma db push && npx prisma db seed` — database populates with HR user and leave types.

---

## Phase 2: Authentication (Login + Register)

**Depends on:** Phase 1

**What:** NextAuth.js config with credentials provider, JWT strategy, login page, register page, auth middleware.

**Produces:**
- `/login` — email + password form
- `/register` — employee self-registration
- Middleware protecting all routes except `/login` and `/register`
- JWT containing userId, email, role, departmentId

**Files:**
- `src/lib/auth.ts` (NextAuth config)
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/middleware.ts`

**Test:** Register a new account → redirected to login → login → redirected to dashboard. Visit `/dashboard` without auth → redirected to `/login`.

---

## Phase 3: Dashboard Layout & Navigation

**Depends on:** Phase 2

**What:** Sidebar, header, role-based navigation. Dashboard shell page with placeholder content.

**Produces:**
- Shared dashboard layout with sidebar + header
- Role-based sidebar links (Employee sees leaves, Manager sees approvals, HR sees admin)
- User menu with role badge + logout
- `/dashboard` page with welcome message

**Files:**
- `src/app/(dashboard)/layout.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/header.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`

**Test:** Login as each role → sidebar shows correct links. Logout works. Layout renders correctly.

---

## Phase 4: HR — Leave Type Management

**Depends on:** Phase 3

**What:** HR can create, edit, activate/deactivate leave types. When a leave type is created, balances are auto-created for all existing employees.

**Produces:**
- `/hr/leave-types` — table of leave types with create/edit/toggle actions
- API routes for leave type CRUD
- Auto-creation of leave balances for all employees when a new type is added

**Files:**
- `src/services/leave.service.ts` (leave type + balance logic)
- `src/app/api/leave-types/route.ts` (GET, POST)
- `src/app/api/leave-types/[id]/route.ts` (PUT, PATCH)
- `src/app/(dashboard)/hr/leave-types/page.tsx`
- `src/components/leaves/leave-type-form.tsx`

**Test:** As HR, create "Annual Leave" with 20 days → appears in table. Edit it. Deactivate it. Check that balances were created for existing users.

---

## Phase 5: HR — Department & User Management

**Depends on:** Phase 4

**What:** HR creates departments, assigns managers, manages users (role changes, department assignments). When a user is assigned to a department, their leave balances are auto-created.

**Produces:**
- `/hr/departments` — department list, create, assign manager
- `/hr/users` — user list, change role, assign department
- Balance auto-creation on department assignment

**Files:**
- `src/services/user.service.ts`
- `src/app/api/departments/route.ts` (GET, POST)
- `src/app/api/departments/[id]/route.ts` (PUT, DELETE)
- `src/app/api/users/route.ts` (GET)
- `src/app/api/users/[id]/route.ts` (PUT)
- `src/app/(dashboard)/hr/departments/page.tsx`
- `src/app/(dashboard)/hr/users/page.tsx`
- `src/components/layout/department-form.tsx`

**Test:** As HR, create "Engineering" department → assign a Manager → assign employees. Verify balances are created for assigned employees.

---

## Phase 6: Leave Request & History

**Depends on:** Phase 5

**What:** Employees submit leave requests. Balance validation on submit. Leave history with filters. Cancel pending requests.

**Produces:**
- `/leaves/new` — leave request form (type, dates, reason) with balance check
- `/leaves` — personal leave history table with status filters + cancel action
- Balance `pendingDays` incremented on submit, decremented on cancel

**Files:**
- `src/app/api/leaves/route.ts` (GET, POST)
- `src/app/api/leaves/[id]/route.ts` (GET, PATCH for cancel)
- `src/app/(dashboard)/leaves/new/page.tsx`
- `src/app/(dashboard)/leaves/page.tsx`
- `src/components/leaves/leave-request-form.tsx`
- `src/components/leaves/leave-history-table.tsx`

**Test:** Submit a leave request → status is PENDING_MANAGER, balance pendingDays increases. Cancel it → pendingDays decreases. Submit with insufficient balance → rejected.

---

## Phase 7: Approval Workflow

**Depends on:** Phase 6

**What:** Manager approves/declines requests for their department. HR gives final approval/decline. Edge cases for manager and HR self-leave.

**Produces:**
- `/manager/approvals` — pending requests in manager's department, approve/decline with comment
- `/hr/approvals` — requests at PENDING_HR stage, approve/decline with comment
- Balance updates: approve → pendingDays down + usedDays up; decline → pendingDays down
- Edge case: Manager self-leave skips to PENDING_HR; HR self-leave auto-approves at HR stage

**Files:**
- `src/app/api/leaves/[id]/approve/route.ts`
- `src/app/api/leaves/[id]/decline/route.ts`
- `src/app/(dashboard)/manager/approvals/page.tsx`
- `src/app/(dashboard)/hr/approvals/page.tsx`
- `src/components/leaves/approval-card.tsx`

**Test:** Submit as employee → manager approves → HR approves → status APPROVED, usedDays updated. Test decline at each stage. Test manager self-leave skips manager stage. Test HR self-leave auto-approves HR stage.

---

## Phase 8: Employee Dashboard

**Depends on:** Phase 7

**What:** Rich dashboard with leave balance cards, recent requests, and action alert banners for managers/HR.

**Produces:**
- Leave balance cards (remaining/total per leave type)
- Recent leave requests with color-coded status badges
- Dashboard alert banners ("You have N requests to review")
- Quick "Request Leave" button

**Files:**
- `src/app/(dashboard)/dashboard/page.tsx` (replace placeholder)
- `src/components/leaves/leave-balance-cards.tsx`
- `src/components/leaves/recent-requests.tsx`
- `src/components/layout/dashboard-alerts.tsx`

**Test:** Login as employee → see balance cards and recent requests. Login as manager → see alert banner with pending count. Login as HR → see HR pending count.

---

## Phase 9: Notification System

**Depends on:** Phase 7

**What:** In-app notifications (bell + dropdown), email notifications via Resend on key events.

**Produces:**
- Notification bell in header with unread count badge
- Dropdown showing recent notifications, mark as read, mark all as read
- Notifications created automatically on: submit, approve, decline
- Email sent via Resend on the same events

**Files:**
- `src/services/notification.service.ts`
- `src/lib/email.ts` (Resend integration)
- `src/app/api/notifications/route.ts` (GET, PATCH mark-all-read)
- `src/app/api/notifications/[id]/route.ts` (PATCH mark-read)
- `src/components/layout/notification-bell.tsx`
- Update `src/components/layout/header.tsx` to include bell

**Test:** Submit a leave request → manager gets in-app notification + email. Approve → employee gets notification. Bell shows unread count, clicking marks as read.

---

## Phase 10: Team Calendar

**Depends on:** Phase 7

**What:** Monthly calendar showing who's on approved leave, color-coded by type. Scoped by role.

**Produces:**
- `/manager/calendar` — department calendar view
- `/hr/calendar` — all-departments view with department filter
- Team calendar also visible to employees for their department

**Files:**
- `src/app/api/calendar/route.ts`
- `src/app/(dashboard)/manager/calendar/page.tsx`
- `src/app/(dashboard)/hr/calendar/page.tsx`
- `src/components/calendar/team-calendar.tsx`
- `src/components/calendar/calendar-day.tsx`

**Test:** Approve some leaves → they appear on the calendar for the correct dates. Manager sees only their department. HR sees all with filter.

---

## Phase 11: Reports & CSV Export

**Depends on:** Phase 7

**What:** Basic reporting dashboards for manager (own department) and HR (all departments). Charts + CSV export.

**Produces:**
- `/manager/reports` — department leave summary
- `/hr/reports` — org-wide leave usage by department + type, balance overview
- Bar chart (usage by department), pie chart (usage by type), balance table
- CSV export button for all report data
- Date range filter

**Files:**
- `src/services/report.service.ts`
- `src/app/api/reports/route.ts`
- `src/app/(dashboard)/manager/reports/page.tsx`
- `src/app/(dashboard)/hr/reports/page.tsx`
- `src/components/reports/usage-by-department-chart.tsx`
- `src/components/reports/usage-by-type-chart.tsx`
- `src/components/reports/balance-table.tsx`
- `src/components/reports/csv-export-button.tsx`

**Test:** With some approved leaves in the system, view reports → charts render with correct data. Export CSV → file downloads with correct data. Filter by date range → data updates.

---

## Phase Order & Dependencies

```
Phase 1  →  Phase 2  →  Phase 3  →  Phase 4  →  Phase 5
                                                    ↓
Phase 11 ← Phase 10 ← Phase 9  ← Phase 8  ← Phase 7  ← Phase 6
```

All phases are strictly sequential. Each produces a working app you can test before moving on.

## How to Use This Plan

1. Start a new session
2. Say: "Implement Phase N of the leave management system" and reference this plan
3. The full spec is at `docs/superpowers/specs/2026-06-25-employee-leave-management-system-design.md`
4. After each phase, test it manually before moving to the next
