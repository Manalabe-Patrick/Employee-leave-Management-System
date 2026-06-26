# Phase 3: Dashboard Layout & Navigation -- Design Spec

**Date:** 2026-06-27
**Status:** Approved
**Parent Spec:** `docs/superpowers/specs/2026-06-25-employee-leave-management-system-design.md`
**Master Plan Phase:** Phase 3

## Overview

Add a shared dashboard layout with a collapsible sidebar, header bar with user menu, and role-based navigation. Replaces the Phase 2 placeholder dashboard with a proper application shell that all `(dashboard)` routes share.

## Approach

Use shadcn's built-in `Sidebar` component (`collapsible="icon"` mode) for the collapsible sidebar. The sidebar expands with labels and collapses to icon-only mode via a toggle button. On mobile (< 768px), the sidebar renders as a `Sheet` overlay. The header sits at the top of the main content area (not full-width -- it moves with sidebar collapse). User menu uses shadcn's `DropdownMenu`.

## Component Architecture

```
(dashboard)/layout.tsx           (Server Component)
├── SidebarProvider
│   ├── AppSidebar               (Client Component, role-filtered nav)
│   └── main
│       ├── Header               (Client Component, toggle + user menu)
│       └── {children}           (page content)
```

The layout is a Server Component that calls `auth()` to get the session, then passes user data (name, email, role) as props to `AppSidebar` and `Header`.

## Sidebar

**File:** `src/components/layout/app-sidebar.tsx` (Client Component)

Uses shadcn primitives: `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarHeader`, `SidebarFooter`, `SidebarSeparator`.

**Collapse behavior:** `collapsible="icon"` prop on the `Sidebar` component. Toggle via `SidebarTrigger` in the header. On mobile, renders as a `Sheet` overlay (handled automatically by shadcn).

**Sidebar header:** App name "LeaveMS" with an icon. In collapsed mode, only the icon shows.

**Sidebar footer:** Logged-in user's name and email. In collapsed mode, shows avatar initial.

**Active link highlighting:** Uses `usePathname()` to compare with each nav item's `href` and sets the `isActive` prop on `SidebarMenuButton`.

### Navigation Items

Navigation is a flat list filtered by the current user's role. Separators divide role-specific sections.

| Link | Path | Icon (lucide-react) | Visible to |
|------|------|---------------------|------------|
| Dashboard | `/dashboard` | `LayoutDashboard` | All |
| My Leaves | `/leaves` | `CalendarDays` | All |
| *separator* | | | Manager, HR |
| Approvals | `/manager/approvals` | `CheckSquare` | Manager |
| Team Calendar | `/manager/calendar` | `Calendar` | Manager |
| Reports | `/manager/reports` | `BarChart3` | Manager |
| *separator* | | | HR |
| HR Approvals | `/hr/approvals` | `ClipboardCheck` | HR |
| *separator* | | | HR |
| Leave Types | `/hr/leave-types` | `FileText` | HR |
| Departments | `/hr/departments` | `Building2` | HR |
| Users | `/hr/users` | `Users` | HR |
| Calendar | `/hr/calendar` | `Calendar` | HR |
| Reports | `/hr/reports` | `BarChart3` | HR |

## Header

**File:** `src/components/layout/header.tsx` (Client Component)

**Left side:**
- `SidebarTrigger` button (toggle sidebar collapse/expand)
- `Separator` (vertical divider)
- Page title text (static "Dashboard" for now; can be made dynamic in future phases)

**Right side:**
- User dropdown menu (`DropdownMenu` from shadcn)
- Trigger: button with user's initials in a colored circle + name (name hidden on small screens)
- Dropdown contents:
  - User's full name (non-interactive label)
  - Role badge (colored: blue for HR, amber for Manager, gray for Employee)
  - Separator
  - "Log out" button -- calls `signOut()` from `next-auth/react`, redirects to `/login`

No notification bell -- deferred to Phase 9. The header is designed so a bell can be inserted to the left of the user menu later.

## Dashboard Page

**File:** `src/app/(dashboard)/dashboard/page.tsx` (Server Component)

Updates the Phase 2 placeholder with:
- Heading: "Welcome back, {firstName}"
- Subtext with colored role badge (same styling as header dropdown)

Remains a Server Component calling `auth()`. The rich dashboard content (balance cards, recent requests, alert banners) is deferred to Phase 8.

## Dashboard Layout

**File:** `src/app/(dashboard)/layout.tsx` (Server Component)

Wraps all `(dashboard)` routes. Calls `auth()` and redirects to `/login` if no session. Passes user data to `AppSidebar` and `Header` as props.

## Files

### New files (custom)

| File | Type | Purpose |
|------|------|---------|
| `src/app/(dashboard)/layout.tsx` | Server Component | Dashboard layout with SidebarProvider |
| `src/components/layout/app-sidebar.tsx` | Client Component | Collapsible sidebar with role-based nav |
| `src/components/layout/header.tsx` | Client Component | Header with toggle, title, user menu |

### Modified files

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/page.tsx` | Replace placeholder with welcome message + role badge |
| `src/types/next-auth.d.ts` | Add `name` to Session.user and JWT types |
| `src/lib/auth.ts` | Explicitly persist `name` in jwt/session callbacks |

### shadcn components added via CLI

| Command | Files created |
|---------|---------------|
| `npx shadcn@latest add sidebar` | `sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, `skeleton.tsx`, `use-mobile.ts` |
| `npx shadcn@latest add dropdown-menu` | `dropdown-menu.tsx` |

## Role Badge Styling

Consistent badge styling used in both the header dropdown and dashboard page:

| Role | Color |
|------|-------|
| HR | Blue (`bg-blue-100 text-blue-700`) |
| Manager | Amber (`bg-amber-100 text-amber-700`) |
| Employee | Gray (`bg-gray-100 text-gray-700`) |

## Session Type Update

The current session type (`src/types/next-auth.d.ts`) only exposes `userId`, `email`, `role`, `departmentId`. The sidebar footer and header user menu need the user's display name, and the dashboard page needs the first name for "Welcome back, {firstName}".

**Changes required:**
- Add `name: string` to the `Session.user` type in `src/types/next-auth.d.ts`
- Add `name: string` to the `JWT` type in the same file
- Update the `jwt` callback in `src/lib/auth.ts` to persist `token.name` (NextAuth already sets it from the `authorize` return, but we make it explicit)
- Update the `session` callback to set `session.user.name = token.name`

The `authorize` function already returns `name: \`${user.firstName} ${user.lastName}\`` -- no change needed there.

## No Changes

- Auth layout (`src/app/(auth)/layout.tsx`) -- untouched
- Proxy (`src/proxy.ts`) -- untouched
- Root layout (`src/app/layout.tsx`) -- untouched

## Test Plan

1. Login as the seeded HR user (`admin@company.com` / `admin123`) -- see sidebar with all nav sections (personal + manager + HR admin)
2. Register a new Employee account, login -- sidebar shows only Dashboard and My Leaves
3. Toggle sidebar collapse -- labels hide, icons remain, content area expands
4. Toggle sidebar expand -- labels reappear
5. Resize browser to mobile width -- sidebar disappears, hamburger button appears in header
6. Click hamburger on mobile -- sidebar slides in as overlay sheet
7. Click user menu -- dropdown shows name, role badge, and logout
8. Click logout -- redirected to `/login`, session cleared
9. Active link highlighting -- current page's nav item is visually highlighted
10. Navigate to a nav link that doesn't have a page yet (e.g., `/leaves`) -- expect 404 (pages built in later phases), but nav and layout still render
