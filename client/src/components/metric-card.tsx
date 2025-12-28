import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({ 
  label, 
  value, 
  change, 
  changeLabel,
  icon: Icon,
  trend = "neutral",
  className = ""
}: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case "up": return "text-positive";
      case "down": return "text-negative";
      default: return "text-muted-foreground";
    }
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {label}
            </p>
            <p className="text-2xl font-bold font-mono truncate" data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-1 ${getTrendColor()}`}>
                <TrendIcon className="w-3 h-3" />
                <span className="text-xs font-mono">
                  {change > 0 ? "+" : ""}{change}%
                  {changeLabel && <span className="text-muted-foreground ml-1">{changeLabel}</span>}
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
