import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

type LeaveRequestWithDetails = {
  id: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; departmentId: string | null };
  leaveType: { name: string };
};

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function getDepartmentManager(departmentId: string) {
  const dept = await db.department.findUnique({
    where: { id: departmentId },
    include: { manager: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  return dept?.manager ?? null;
}

async function getAllHRUsers() {
  return db.user.findMany({
    where: { role: "HR" },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
}

export async function getUserNotifications(userId: string, limit: number = 20) {
  return db.notification.findMany({
    where: { userId },
    include: {
      leaveRequest: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount(userId: string) {
  return db.notification.count({
    where: { userId, isRead: false },
  });
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    return null;
  }

  return db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

export async function getLeaveRequestWithDetails(requestId: string) {
  return db.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } },
      leaveType: { select: { name: true } },
    },
  });
}

export async function notifyLeaveSubmitted(leaveRequest: LeaveRequestWithDetails) {
  const { user, leaveType } = leaveRequest;
  const employeeName = `${user.firstName} ${user.lastName}`;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;
  const title = "New Leave Request";
  const message = `${employeeName} has submitted a ${leaveType.name} request for ${dateRange} (${leaveRequest.totalDays} day${leaveRequest.totalDays === 1 ? "" : "s"})`;
  const emailSubject = `New Leave Request from ${employeeName}`;

  if (leaveRequest.status === "PENDING_HR") {
    const hrUsers = await getAllHRUsers();
    const recipients = hrUsers.filter((hr) => hr.id !== user.id);
    if (recipients.length === 0) {
      console.warn("[notifications] No HR users to notify for submitted leave request");
      return;
    }
    await Promise.all(
      recipients.flatMap((hr) => [
        db.notification.create({
          data: { userId: hr.id, title, message, type: "LEAVE_SUBMITTED", relatedLeaveRequestId: leaveRequest.id },
        }),
        sendEmail({ to: hr.email, subject: emailSubject, text: message }),
      ])
    );
    return;
  }

  if (!user.departmentId) {
    console.warn("[notifications] No department for user, cannot notify manager");
    return;
  }

  const manager = await getDepartmentManager(user.departmentId);
  if (!manager || manager.id === user.id) {
    return;
  }

  await Promise.all([
    db.notification.create({
      data: { userId: manager.id, title, message, type: "LEAVE_SUBMITTED", relatedLeaveRequestId: leaveRequest.id },
    }),
    sendEmail({ to: manager.email, subject: emailSubject, text: message }),
  ]);
}

export async function notifyLeaveApproved(leaveRequest: LeaveRequestWithDetails) {
  const { user, leaveType } = leaveRequest;
  const employeeName = `${user.firstName} ${user.lastName}`;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;

  if (leaveRequest.status === "PENDING_HR") {
    const title = "Leave Request Awaiting HR Approval";
    const message = `${employeeName}'s ${leaveType.name} request has been approved by their manager and needs your review`;
    const hrUsers = await getAllHRUsers();
    const recipients = hrUsers.filter((hr) => hr.id !== user.id);
    if (recipients.length === 0) {
      console.warn("[notifications] No HR users to notify for approved leave request");
      return;
    }
    await Promise.all(
      recipients.flatMap((hr) => [
        db.notification.create({
          data: { userId: hr.id, title, message, type: "LEAVE_APPROVED", relatedLeaveRequestId: leaveRequest.id },
        }),
        sendEmail({ to: hr.email, subject: `Leave Request Awaiting Approval: ${employeeName}`, text: message }),
      ])
    );
    return;
  }

  if (leaveRequest.status === "APPROVED") {
    const title = "Leave Request Approved";
    const message = `Your ${leaveType.name} request for ${dateRange} has been approved`;
    await Promise.all([
      db.notification.create({
        data: { userId: user.id, title, message, type: "LEAVE_APPROVED", relatedLeaveRequestId: leaveRequest.id },
      }),
      sendEmail({ to: user.email, subject: "Leave Request Approved", text: message }),
    ]);
  }
}

export async function notifyLeaveDeclined(leaveRequest: LeaveRequestWithDetails, declinerName: string) {
  const { user, leaveType } = leaveRequest;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;
  const title = "Leave Request Declined";
  const message = `Your ${leaveType.name} request for ${dateRange} has been declined by ${declinerName}`;

  await Promise.all([
    db.notification.create({
      data: { userId: user.id, title, message, type: "LEAVE_DECLINED", relatedLeaveRequestId: leaveRequest.id },
    }),
    sendEmail({ to: user.email, subject: "Leave Request Declined", text: message }),
  ]);
}

export async function notifyLeaveCancelled(leaveRequest: LeaveRequestWithDetails) {
  const { user, leaveType } = leaveRequest;
  const employeeName = `${user.firstName} ${user.lastName}`;
  const dateRange = `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`;
  const title = "Leave Request Cancelled";
  const message = `${employeeName} has cancelled their ${leaveType.name} request for ${dateRange}`;

  const recipients: { id: string; email: string }[] = [];

  if (user.departmentId) {
    const manager = await getDepartmentManager(user.departmentId);
    if (manager && manager.id !== user.id) {
      recipients.push(manager);
    }
  }

  if (leaveRequest.status === "PENDING_HR") {
    const hrUsers = await getAllHRUsers();
    for (const hr of hrUsers) {
      if (hr.id !== user.id && !recipients.some((r) => r.id === hr.id)) {
        recipients.push(hr);
      }
    }
  }

  if (recipients.length === 0) return;

  await Promise.all(
    recipients.flatMap((recipient) => [
      db.notification.create({
        data: { userId: recipient.id, title, message, type: "LEAVE_CANCELLED", relatedLeaveRequestId: leaveRequest.id },
      }),
      sendEmail({ to: recipient.email, subject: `Leave Request Cancelled: ${employeeName}`, text: message }),
    ])
  );
}
