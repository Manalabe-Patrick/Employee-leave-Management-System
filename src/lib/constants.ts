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
