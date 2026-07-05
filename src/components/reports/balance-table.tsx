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
      <div className="p-8 text-center text-sm text-muted-foreground">
        No balance data available.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="px-6">Employee</TableHead>
          <TableHead>Leave Type</TableHead>
          <TableHead className="text-right">Allowance</TableHead>
          <TableHead className="text-right">Used</TableHead>
          <TableHead className="text-right">Pending</TableHead>
          <TableHead className="text-right pr-6">Remaining</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i} className="border-b-0 border-t">
            <TableCell className="font-medium px-6">{row.userName}</TableCell>
            <TableCell>{row.leaveTypeName}</TableCell>
            <TableCell className="text-right">{row.totalAllowance}</TableCell>
            <TableCell className="text-right">{row.usedDays}</TableCell>
            <TableCell className="text-right">{row.pendingDays}</TableCell>
            <TableCell className="text-right pr-6 font-semibold">{row.remainingDays}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
