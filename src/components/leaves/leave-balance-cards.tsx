import { Card, CardContent } from "@/components/ui/card";

type Balance = {
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  leaveType: { id: string; name: string };
};

type LeaveBalanceCardsProps = {
  balances: Balance[];
};

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  if (balances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No leave balances — contact HR to be assigned to a department
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => {
        const remaining =
          balance.totalAllowance - balance.usedDays - balance.pendingDays;
        const pct =
          balance.totalAllowance > 0
            ? (remaining / balance.totalAllowance) * 100
            : 0;

        return (
          <Card key={balance.leaveType.id}>
            <CardContent className="flex items-center gap-5 p-5">
              <div className="relative size-16 shrink-0">
                <svg
                  className="size-full -rotate-90"
                  viewBox="0 0 36 36"
                  aria-hidden="true"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="2.5"
                    className="stroke-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="2.5"
                    className="stroke-primary transition-all duration-500"
                    pathLength="100"
                    strokeDasharray={`${Math.max(0, pct)} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                  {remaining}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  {balance.leaveType.name}
                </p>
                <p className="text-2xl font-bold">
                  {remaining}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {balance.totalAllowance} days
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {balance.usedDays} used
                  {balance.pendingDays > 0 && (
                    <> · {balance.pendingDays} pending</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
