import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BalanceRow = {
  userName: string;
  leaveTypeName: string;
  totalAllowance: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
};

type BalanceTableProps = {
  data: BalanceRow[];
};

export function BalanceTable({ data }: BalanceTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No balance data available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Leave Type</TableHead>
            <TableHead className="text-right">Allowance</TableHead>
            <TableHead className="text-right">Used</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{row.userName}</TableCell>
              <TableCell>{row.leaveTypeName}</TableCell>
              <TableCell className="text-right">{row.totalAllowance}</TableCell>
              <TableCell className="text-right">{row.usedDays}</TableCell>
              <TableCell className="text-right">{row.pendingDays}</TableCell>
              <TableCell className="text-right">{row.remainingDays}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
