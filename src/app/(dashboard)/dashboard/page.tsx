import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { roleBadgeClasses } from "@/lib/constants";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const firstName = session.user.name.split(" ")[0];

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Welcome back, {firstName}
      </h1>
      <p className="mt-2 text-muted-foreground">
        You are logged in as{" "}
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClasses[session.user.role]}`}
        >
          {session.user.role}
        </span>
      </p>
    </div>
  );
}
