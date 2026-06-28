"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Calendar,
  BarChart3,
  ClipboardCheck,
  FileText,
  Building2,
  Users,
  CalendarRange,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const commonItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Leaves", href: "/leaves", icon: CalendarDays },
  { label: "Team Calendar", href: "/calendar", icon: Calendar },
];

const managerItems: NavItem[] = [
  { label: "Approvals", href: "/manager/approvals", icon: CheckSquare },
  { label: "Team Calendar", href: "/manager/calendar", icon: Calendar },
  { label: "Reports", href: "/manager/reports", icon: BarChart3 },
];

const hrApprovalItems: NavItem[] = [
  { label: "HR Approvals", href: "/hr/approvals", icon: ClipboardCheck },
];

const hrAdminItems: NavItem[] = [
  { label: "Leave Types", href: "/hr/leave-types", icon: FileText },
  { label: "Departments", href: "/hr/departments", icon: Building2 },
  { label: "Users", href: "/hr/users", icon: Users },
  { label: "Calendar", href: "/hr/calendar", icon: CalendarRange },
  { label: "Reports", href: "/hr/reports", icon: BarChart3 },
];

type AppSidebarProps = {
  user: {
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
  };
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  const isManager = user.role === "MANAGER";
  const isHR = user.role === "HR";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarDays className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">LeaveMS</span>
                <span className="truncate text-xs text-muted-foreground">
                  Leave Management
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {commonItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  tooltip={item.label}
                  isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                  render={<Link href={item.href} />}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {isManager && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {managerItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        {isHR && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {hrApprovalItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {hrAdminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
