import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";

interface Column<T> {
  key: keyof T | string;
  label: string;
  align?: "left" | "center" | "right";
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({ 
  columns, 
  data, 
  onRowClick,
  emptyMessage = "No data available"
}: DataTableProps<T>) {
  const getNestedValue = (obj: T, path: string) => {
    return path.split('.').reduce((acc, part) => acc?.[part], obj as any);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((column) => (
              <TableHead 
                key={String(column.key)}
                className={`text-xs uppercase tracking-wider text-muted-foreground font-medium py-3
                  ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length} 
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow 
                key={index}
                className={`border-border ${onRowClick ? 'cursor-pointer hover-elevate' : ''}`}
                onClick={() => onRowClick?.(row)}
                data-testid={`table-row-${index}`}
              >
                {columns.map((column) => {
                  const value = getNestedValue(row, String(column.key));
                  return (
                    <TableCell 
                      key={String(column.key)}
                      className={`py-3 font-mono text-sm
                        ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
                    >
                      {column.render ? column.render(value, row) : value}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const getVariant = () => {
    switch (sentiment?.toLowerCase()) {
      case "bullish":
      case "positive":
        return "bg-positive/20 text-positive border-positive/30";
      case "bearish":
      case "negative":
        return "bg-negative/20 text-negative border-negative/30";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  return (
    <Badge variant="outline" className={`${getVariant()} text-xs font-medium`}>
      {sentiment}
    </Badge>
  );
}

export function FlowIndicator({ type, volume }: { type: string; volume: number }) {
  const isPositive = type?.toLowerCase() === "accumulation" || type?.toLowerCase() === "buy";
  
  return (
    <div className={`flex items-center gap-1 ${isPositive ? 'text-positive' : 'text-negative'}`}>
      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      <span className="font-mono text-sm">{volume.toLocaleString()}</span>
    </div>
  );
}

export function TickerCell({ ticker, price }: { ticker: string; price?: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-foreground">{ticker}</span>
      {price && <span className="text-xs text-muted-foreground font-mono">${price}</span>}
    </div>
  );
}
