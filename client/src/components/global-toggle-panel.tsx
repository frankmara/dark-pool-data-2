import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Power, 
  ScanSearch, 
  TrendingUp, 
  MessageSquare, 
  BarChart3,
  Wifi,
  WifiOff,
  Loader2
} from "lucide-react";

interface AutomationToggles {
  masterEnabled: boolean;
  darkPoolScanner: boolean;
  unusualOptionsSweeps: boolean;
  autoThreadPosting: boolean;
  analyticsTracking: boolean;
}

interface GlobalTogglePanelProps {
  toggles: AutomationToggles;
  onToggleChange: (key: keyof AutomationToggles, value: boolean) => void;
  isConnected?: boolean;
  isLoading?: boolean;
}

export function GlobalTogglePanel({ 
  toggles, 
  onToggleChange,
  isConnected = true,
  isLoading = false
}: GlobalTogglePanelProps) {
  if (isLoading) {
    return (
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-4" data-testid="global-toggle-panel">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-2 h-2 rounded-full" />
            <span className="font-semibold text-sm tracking-wide">RIPPLET</span>
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-4" data-testid="global-toggle-panel">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div 
            className={`w-2 h-2 rounded-full ${toggles.masterEnabled ? 'bg-positive pulse-dot' : 'bg-muted-foreground'}`}
            data-testid="status-indicator-master"
          />
          <span className="font-semibold text-sm tracking-wide">RIPPLET</span>
          <Badge 
            variant="outline" 
            className="text-xs font-mono bg-primary/10 text-primary border-primary/30"
            data-testid="badge-workspace-name"
          >
            Dark Pool Data 2.0
          </Badge>
        </div>
        
        <div className="h-6 w-px bg-border" />
        
        <div className="flex items-center gap-2" data-testid="toggle-master">
          <Power className={`w-4 h-4 ${toggles.masterEnabled ? 'text-positive' : 'text-muted-foreground'}`} />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Master</span>
          <Switch 
            checked={toggles.masterEnabled}
            onCheckedChange={(checked) => onToggleChange('masterEnabled', checked)}
            data-testid="switch-master"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2" data-testid="toggle-dark-pool">
          <ScanSearch className={`w-4 h-4 ${toggles.darkPoolScanner && toggles.masterEnabled ? 'text-positive' : 'text-muted-foreground'}`} />
          <span className="text-xs uppercase tracking-wider text-muted-foreground hidden lg:inline">Dark Pool</span>
          <Switch 
            checked={toggles.darkPoolScanner}
            onCheckedChange={(checked) => onToggleChange('darkPoolScanner', checked)}
            disabled={!toggles.masterEnabled}
            data-testid="switch-dark-pool"
          />
        </div>
        
        <div className="flex items-center gap-2" data-testid="toggle-options">
          <TrendingUp className={`w-4 h-4 ${toggles.unusualOptionsSweeps && toggles.masterEnabled ? 'text-positive' : 'text-muted-foreground'}`} />
          <span className="text-xs uppercase tracking-wider text-muted-foreground hidden lg:inline">Options</span>
          <Switch 
            checked={toggles.unusualOptionsSweeps}
            onCheckedChange={(checked) => onToggleChange('unusualOptionsSweeps', checked)}
            disabled={!toggles.masterEnabled}
            data-testid="switch-options"
          />
        </div>
        
        <div className="flex items-center gap-2" data-testid="toggle-auto-thread">
          <MessageSquare className={`w-4 h-4 ${toggles.autoThreadPosting && toggles.masterEnabled ? 'text-positive' : 'text-muted-foreground'}`} />
          <span className="text-xs uppercase tracking-wider text-muted-foreground hidden lg:inline">Auto-Thread</span>
          <Switch 
            checked={toggles.autoThreadPosting}
            onCheckedChange={(checked) => onToggleChange('autoThreadPosting', checked)}
            disabled={!toggles.masterEnabled}
            data-testid="switch-auto-thread"
          />
        </div>
        
        <div className="h-6 w-px bg-border" />
        
        <div className="flex items-center gap-2" data-testid="toggle-analytics">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground hidden lg:inline">Analytics</span>
          <Badge variant="secondary" className="text-xs" data-testid="badge-always-on">Always On</Badge>
        </div>
        
        <div className="h-6 w-px bg-border" />
        
        <div className="flex items-center gap-2" data-testid="connection-status">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-positive" />
              <span className="text-xs text-positive font-mono" data-testid="status-live">LIVE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-negative" />
              <span className="text-xs text-negative font-mono" data-testid="status-offline">OFFLINE</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
