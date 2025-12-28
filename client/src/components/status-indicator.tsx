import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Loader2, AlertTriangle } from "lucide-react";

type Status = "active" | "inactive" | "pending" | "error" | "warning" | "connected" | "disconnected";

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function StatusIndicator({ 
  status, 
  label, 
  showIcon = true,
  size = "md" 
}: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "active":
      case "connected":
        return {
          icon: Check,
          color: "bg-positive/20 text-positive border-positive/30",
          dotColor: "bg-positive",
          text: label || "Active"
        };
      case "inactive":
      case "disconnected":
        return {
          icon: X,
          color: "bg-muted text-muted-foreground border-muted",
          dotColor: "bg-muted-foreground",
          text: label || "Inactive"
        };
      case "pending":
        return {
          icon: Loader2,
          color: "bg-primary/20 text-primary border-primary/30",
          dotColor: "bg-primary",
          text: label || "Pending",
          animate: true
        };
      case "error":
        return {
          icon: X,
          color: "bg-negative/20 text-negative border-negative/30",
          dotColor: "bg-negative",
          text: label || "Error"
        };
      case "warning":
        return {
          icon: AlertTriangle,
          color: "bg-warning/20 text-warning border-warning/30",
          dotColor: "bg-warning",
          text: label || "Warning"
        };
      default:
        return {
          icon: Clock,
          color: "bg-muted text-muted-foreground border-muted",
          dotColor: "bg-muted-foreground",
          text: label || status
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${sizeClasses} gap-1.5 font-medium`}
    >
      {showIcon && (
        <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
      )}
      {config.text}
    </Badge>
  );
}

export function StatusDot({ status, pulse = false }: { status: Status; pulse?: boolean }) {
  const getColor = () => {
    switch (status) {
      case "active":
      case "connected":
        return "bg-positive";
      case "inactive":
      case "disconnected":
        return "bg-muted-foreground";
      case "pending":
        return "bg-primary";
      case "error":
        return "bg-negative";
      case "warning":
        return "bg-warning";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <div className={`w-2 h-2 rounded-full ${getColor()} ${pulse ? 'pulse-dot' : ''}`} />
  );
}
