import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getUserNotifications, markAllAsRead } from "@/services/notification.service";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await getUserNotifications(session.user.userId, 20);
  return NextResponse.json(notifications);
}

export async function PATCH() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await markAllAsRead(session.user.userId);
  return NextResponse.json({ success: true, count });
}
