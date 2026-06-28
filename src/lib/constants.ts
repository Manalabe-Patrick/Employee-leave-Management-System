export const roleBadgeClasses: Record<"EMPLOYEE" | "MANAGER" | "HR", string> = {
  HR: "bg-blue-100 text-blue-700",
  MANAGER: "bg-amber-100 text-amber-700",
  EMPLOYEE: "bg-gray-100 text-gray-700",
};

export const statusBadgeStyles: Record<string, { className: string; label: string }> = {
  PENDING_MANAGER: {
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    label: "Pending Manager",
  },
  PENDING_HR: {
    className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    label: "Pending HR",
  },
  APPROVED: {
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    label: "Approved",
  },
  DECLINED: {
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    label: "Declined",
  },
  CANCELLED: {
    className: "bg-gray-100 text-gray-500 hover:bg-gray-100",
    label: "Cancelled",
  },
};

export const LEAVE_TYPE_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

export const LEAVE_TYPE_DOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];

export function getLeaveTypeColorIndex(leaveTypeId: string): number {
  let hash = 0;
  for (let i = 0; i < leaveTypeId.length; i++) {
    hash = (hash * 31 + leaveTypeId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % LEAVE_TYPE_COLORS.length;
}
