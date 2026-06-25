# Employee Leave Management System — Design Spec

**Date:** 2026-06-25
**Status:** Approved

## Overview

A web-based Employee Leave Management System where employees submit leave requests, managers approve at the department level, and HR gives final approval. The system tracks leave balances, sends notifications, displays a team calendar, and provides basic reporting.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, Server Components, Server Actions)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** NextAuth.js (Credentials provider, JWT strategy)
- **Styling:** Tailwind CSS + shadcn/ui
- **Email:** Resend
- **Language:** TypeScript throughout

## Roles & Permissions

Three roles: **Employee**, **Manager**, **HR**.

| Action                              | Employee          | Manager              | HR                |
|-------------------------------------|-------------------|----------------------|-------------------|
| Register/login                      | Yes               | Yes                  | Yes               |
| Submit leave request                | Yes               | Yes                  | Yes               |
| View own leave history              | Yes               | Yes                  | Yes               |
| Approve/decline (manager stage)     | No                | Own department only  | No                |
| Approve/decline (HR stage)          | No                | No                   | Yes               |
| Manage leave types                  | No                | No                   | Yes               |
| Manage departments                  | No                | No                   | Yes               |
| View team calendar                  | Own department    | Own department       | All departments   |
| View reports                        | No                | Own department       | All departments   |
| Manage users / assign roles         | No                | No                   | Yes               |

- Anyone can register as an Employee by default.
- HR promotes users to Manager or HR roles.
- HR assigns employees to departments.

## Data Model

### Users

| Field        | Type     | Notes                                    |
|--------------|----------|------------------------------------------|
| id           | UUID     | Primary key                              |
| email        | String   | Unique                                   |
| password     | String   | Hashed with bcrypt                       |
| firstName    | String   |                                          |
| lastName     | String   |                                          |
| role         | Enum     | EMPLOYEE, MANAGER, HR                    |
| departmentId | UUID?    | FK → Department (nullable for new users) |
| profileImage | String?  | Optional                                 |
| createdAt    | DateTime |                                          |
| updatedAt    | DateTime |                                          |

### Departments

| Field       | Type     | Notes              |
|-------------|----------|--------------------|
| id          | UUID     | Primary key        |
| name        | String   | Unique             |
| description | String?  |                    |
| managerId   | UUID     | FK → User          |
| createdAt   | DateTime |                    |

Each department has one manager. Employees belong to one department.

### Leave Types

| Field            | Type     | Notes                          |
|------------------|----------|--------------------------------|
| id               | UUID     | Primary key                    |
| name             | String   | e.g., "Annual Leave"           |
| description      | String?  |                                |
| defaultAllowance | Int      | Days per year                  |
| isPaid           | Boolean  |                                |
| isActive         | Boolean  | HR can deactivate without deleting |
| createdAt        | DateTime |                                |

### Leave Balances

| Field          | Type | Notes                              |
|----------------|------|------------------------------------|
| id             | UUID | Primary key                        |
| userId         | UUID | FK → User                          |
| leaveTypeId    | UUID | FK → LeaveType                     |
| year           | Int  | Calendar year                      |
| totalAllowance | Int  | May differ from default per user   |
| usedDays       | Int  | Incremented on approval            |
| pendingDays    | Int  | Incremented on submit, decremented on resolve |

One record per user per leave type per year. Unique constraint on (userId, leaveTypeId, year).

### Leave Requests

| Field               | Type     | Notes                                                  |
|---------------------|----------|--------------------------------------------------------|
| id                  | UUID     | Primary key                                            |
| userId              | UUID     | FK → User (the requester)                              |
| leaveTypeId         | UUID     | FK → LeaveType                                         |
| startDate           | Date     |                                                        |
| endDate             | Date     |                                                        |
| totalDays           | Int      | Calculated from date range                             |
| reason              | String   |                                                        |
| status              | Enum     | PENDING_MANAGER, PENDING_HR, APPROVED, DECLINED, CANCELLED |
| managerComment      | String?  |                                                        |
| hrComment           | String?  |                                                        |
| reviewedByManagerId | UUID?    | FK → User                                              |
| reviewedByHRId      | UUID?    | FK → User                                              |
| managerReviewedAt   | DateTime?|                                                        |
| hrReviewedAt        | DateTime?|                                                        |
| createdAt           | DateTime |                                                        |

### Notifications

| Field                 | Type     | Notes                                                    |
|-----------------------|----------|----------------------------------------------------------|
| id                    | UUID     | Primary key                                              |
| userId                | UUID     | FK → User (recipient)                                    |
| title                 | String   |                                                          |
| message               | String   |                                                          |
| type                  | Enum     | LEAVE_SUBMITTED, LEAVE_APPROVED, LEAVE_DECLINED, etc.    |
| isRead                | Boolean  | Default false                                            |
| relatedLeaveRequestId | UUID?    | FK → LeaveRequest                                        |
| createdAt             | DateTime |                                                          |

## Authentication

- NextAuth.js with Credentials provider (email + password).
- Passwords hashed with bcrypt before storing.
- JWT session strategy — token contains userId, email, role, departmentId.
- Middleware checks JWT on every request to protected routes.
- Unauthenticated users are redirected to `/login`.

## Approval Workflow

Sequential two-stage approval:

1. Employee submits request → status = **PENDING_MANAGER**
2. Department manager reviews:
   - Approve → status = **PENDING_HR**
   - Decline → status = **DECLINED**, pendingDays decremented, employee notified
3. HR reviews:
   - Approve → status = **APPROVED**, pendingDays decremented, usedDays incremented, employee notified
   - Decline → status = **DECLINED**, pendingDays decremented, employee notified

Employee can cancel a request while it is still in PENDING_MANAGER or PENDING_HR status.

**Edge case — Manager submits leave:** When a Manager submits their own leave request, the manager stage is auto-approved (they are their own department manager), and the request goes directly to PENDING_HR for HR review.

**Edge case — HR submits leave:** When an HR user submits leave, the request goes to their department manager first (PENDING_MANAGER), then is auto-approved at the HR stage since they are HR themselves. This ensures at least one independent review.

## Leave Balance Logic

- When HR creates a leave type with a default allowance, balances are auto-created for all employees for the current year.
- When a new employee is assigned to a department, balances are created for all active leave types.
- On leave request submission: validate totalDays <= (totalAllowance - usedDays - pendingDays). If insufficient, reject the submission.
- On approval: decrement pendingDays, increment usedDays.
- On decline or cancellation: decrement pendingDays.

## Pages & Features

### Public Pages

- `/login` — Email + password login form
- `/register` — Employee self-registration (default role: Employee)

### Employee Dashboard (`/dashboard`)

- Leave balance cards (one per leave type, showing remaining/total days)
- Recent leave requests with status badges (color-coded)
- Notification bell with unread count in header
- Quick "Request Leave" button
- Dashboard alert banners for pending actions

### Leave Request (`/leaves/new`)

- Form: leave type dropdown, start date, end date (auto-calculates total days), reason textarea
- Client-side validation: end date >= start date, balance check
- Server-side validation: balance re-check, date overlap check

### Leave History (`/leaves`)

- Table of personal leave requests
- Filters: status, date range, leave type
- Cancel button on pending requests

### Manager Views

- `/manager/approvals` — Pending requests from their department, approve/decline with comment
- `/manager/calendar` — Monthly/weekly calendar of approved leaves in their department
- `/manager/reports` — Department leave summary stats

### HR Views

- `/hr/approvals` — Requests at PENDING_HR stage, approve/decline with comment
- `/hr/leave-types` — CRUD for leave types (name, description, default allowance, isPaid, isActive)
- `/hr/departments` — Create departments, assign managers
- `/hr/users` — View all users, change roles, assign to departments
- `/hr/reports` — Leave usage by department and type, CSV export
- `/hr/calendar` — All-departments calendar view

## Notifications

### In-App

- Notification bell icon in the header with unread count badge
- Dropdown list showing recent notifications
- Click to mark as read and navigate to related leave request
- "Mark all as read" action

### Email

Transactional emails sent via Resend on these events:
- Leave request submitted → notify department manager
- Manager approved → notify HR
- Manager declined → notify employee
- HR approved → notify employee
- HR declined → notify employee

### Dashboard Alerts

- Banner cards on the dashboard for pending actions:
  - Manager: "You have N requests to review"
  - HR: "You have N requests awaiting final approval"

## Team Calendar

- Monthly view with day cells showing who is on leave
- Color-coded by leave type
- Manager sees their department; HR sees all departments with a department filter
- Employees see their own department's calendar

## Reports

- Leave usage summary by department (table + bar chart)
- Leave usage by type (pie/donut chart)
- Employee leave balance overview (table)
- Date range filter
- CSV export for all report data

## Project Structure

```
src/
├── app/
│   ├── (auth)/             # Route group: login, register
│   ├── (dashboard)/        # Protected routes
│   │   ├── dashboard/
│   │   ├── leaves/
│   │   ├── manager/
│   │   └── hr/
│   ├── api/
│   └── layout.tsx
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Header, Sidebar, NotificationBell
│   ├── leaves/             # Leave-specific components
│   ├── calendar/           # Team calendar components
│   └── reports/            # Charts and report components
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Prisma client instance
│   ├── email.ts            # Email sending utility
│   └── utils.ts            # Shared helpers
├── services/
│   ├── leave.service.ts    # Leave request logic, balance checks
│   ├── user.service.ts     # User management
│   ├── notification.service.ts
│   └── report.service.ts
├── types/
└── prisma/
    ├── schema.prisma
    └── seed.ts             # Default leave types, demo HR user
```

### Key Decisions

- **Services layer** separates business logic from route handlers. API routes stay thin; logic is testable.
- **Route groups** `(auth)` and `(dashboard)` use different layouts — no sidebar for auth pages, sidebar + header for dashboard pages.
- **Server Components** by default. Client Components only for interactive elements (forms, calendar, notification dropdown).
- **Prisma** handles all database access. No raw SQL.
- **Resend** for transactional emails (free tier: 100 emails/day).
