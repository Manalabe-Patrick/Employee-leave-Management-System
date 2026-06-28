import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No leave balances — contact HR to be assigned to a department
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => {
        const remaining =
          balance.totalAllowance - balance.usedDays - balance.pendingDays;

        return (
          <Card key={balance.leaveType.id}>
            <CardHeader>
              <CardTitle>{balance.leaveType.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {remaining}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {balance.totalAllowance} days remaining
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {balance.usedDays} used
                {balance.pendingDays > 0 && (
                  <> · {balance.pendingDays} pending</>
                )}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
