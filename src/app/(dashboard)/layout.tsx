import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { PageTransition } from "@/components/layout/page-transition";
import { getUserNotifications, getUnreadCount } from "@/services/notification.service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(session.user.userId),
    getUnreadCount(session.user.userId),
  ]);

  const serializedNotifications = notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <Header user={user} notifications={serializedNotifications} unreadCount={unreadCount} />
          <main className="flex-1 p-4 md:p-6"><PageTransition>{children}</PageTransition></main>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
