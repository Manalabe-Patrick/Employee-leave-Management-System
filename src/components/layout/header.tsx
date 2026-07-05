"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/(dashboard)/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleBadgeClasses } from "@/lib/constants";
import { NotificationBell } from "@/components/layout/notification-bell";

type HeaderProps = {
  user: {
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "HR";
  };
  notifications: {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: Date | string;
    leaveRequest: { id: string } | null;
  }[];
  unreadCount: number;
};

const roleLabels: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR: "HR Admin",
};

export function Header({ user, notifications, unreadCount }: HeaderProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/30 bg-card/60 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5 bg-border/40" />
      <h1 className="text-sm font-semibold tracking-tight text-foreground/80">Dashboard</h1>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />

        <Separator orientation="vertical" className="mx-1 hidden h-5 bg-border/60 sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="gap-3 rounded-xl px-2 hover:bg-sidebar-accent" />
            }
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shadow-sm">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-sm font-semibold leading-tight">{user.name}</div>
              <div className="text-xs text-muted-foreground leading-tight">{roleLabels[user.role] ?? user.role}</div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
              <DropdownMenuLabel>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClasses[user.role]}`}
                >
                  {user.role}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
