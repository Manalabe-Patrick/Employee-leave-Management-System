import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";

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

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <Header user={user} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
