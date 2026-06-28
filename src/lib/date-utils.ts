export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  if (endDate < startDate) return 0;

  let count = 0;
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
