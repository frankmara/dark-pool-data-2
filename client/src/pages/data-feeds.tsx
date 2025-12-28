import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { StatusIndicator, StatusDot } from "@/components/status-indicator";
import { useToast } from "@/hooks/use-toast";
import type { ApiConnector, ScannerConfig } from "@shared/schema";
import { 
  Database, 
  Plus, 
  Settings, 
  RefreshCw, 
  ExternalLink, 
  Check, 
  X,
  Zap,
  Clock,
  Activity,
  Shield,
  Key,
  Radar,
  Play,
  Filter,
  TrendingUp,
  DollarSign,
  BarChart3,
  AlertCircle
} from "lucide-react";
import { SiTwitter } from "react-icons/si";

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

export default function DataFeeds() {
  const { toast } = useToast();
  
  const { data: connectors = [], isLoading: connectorsLoading } = useQuery<ApiConnector[]>({
    queryKey: ['/api/connectors'],
  });

  const { data: scannerConfig, isLoading: configLoading } = useQuery<ScannerConfig>({
    queryKey: ['/api/scanner/config'],
  });

  const { data: keyStatus = [] } = useQuery<Array<{
    provider: string;
    name: string;
    envVar: string;
    configured: boolean;
    status: string;
  }>>({
    queryKey: ['/api/connectors/keys/status'],
  });

  const updateConnectorMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ApiConnector> }) => {
      return apiRequest('PATCH', `/api/connectors/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connectors'] });
    },
  });

  const testConnectorMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/connectors/${id}/test`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/connectors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/connectors/keys/status'] });
      if (data.success) {
        toast({ title: "Connected", description: data.message });
      } else {
        toast({ title: "Connection Failed", description: data.message, variant: "destructive" });
      }
    },
  });

  const updateScannerMutation = useMutation({
    mutationFn: async (updates: Partial<ScannerConfig>) => {
      return apiRequest('PATCH', '/api/scanner/config', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/config'] });
      toast({ title: "Scanner Updated", description: "Filter settings have been saved" });
    },
  });

  const runScannerMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/scanner/run');
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Scanner Running", description: "Scan initiated successfully" });
      } else {
        toast({ title: "Scanner Error", description: data.error, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Scanner Error", description: error.message || "Failed to run scanner", variant: "destructive" });
    },
  });

  const connectedCount = connectors.filter(c => c.status === "connected").length;
  const pendingCount = connectors.filter(c => c.status === "pending").length;
  const disconnectedCount = connectors.filter(c => c.status === "disconnected").length;
  const missingKeysCount = keyStatus.filter(k => !k.configured && k.provider !== "sec_edgar").length;

  const isLoading = connectorsLoading || configLoading;

  return (
    <div className="p-6 space-y-6 overflow-auto h-full" data-testid="page-data-feeds">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-data-feeds">Data Feeds & API Connectors</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your data sources and Master Scanner configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => runScannerMutation.mutate()}
            disabled={runScannerMutation.isPending || connectedCount === 0}
            data-testid="button-run-scanner"
          >
            <Play className="w-4 h-4 mr-2" />
            Run Scanner
          </Button>
          <Button data-testid="button-add-connector">
            <Plus className="w-4 h-4 mr-2" />
            Add Connector
          </Button>
        </div>
      </div>

      {missingKeysCount > 0 && (
        <Card className="border-warning/50 bg-warning/5" data-testid="card-missing-keys-warning">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-sm">API Keys Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {missingKeysCount} API key(s) need to be configured for full functionality. 
                  Add them in the Secrets tab of your Replit project.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {keyStatus.filter(k => !k.configured && k.provider !== "sec_edgar").map(k => (
                    <Badge key={k.provider} variant="outline" className="font-mono text-xs">
                      {k.envVar}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-connected-count">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-positive/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-positive" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="metric-connected">{connectedCount}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-count">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="metric-pending">{pendingCount}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-disconnected-count">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                <X className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="metric-disconnected">{disconnectedCount}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Disconnected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-refresh-interval">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="metric-refresh">
                  {scannerConfig?.refreshIntervalMs ? Math.round(scannerConfig.refreshIntervalMs / 60000) : 5}m
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Refresh Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" data-testid="card-master-scanner">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Radar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Master Dark Pool & Unusual Options Scanner</CardTitle>
                  <CardDescription>Configure high-signal event filters</CardDescription>
                </div>
              </div>
              <Switch
                checked={scannerConfig?.enabled ?? true}
                onCheckedChange={(enabled) => updateScannerMutation.mutate({ enabled })}
                data-testid="switch-scanner-enabled"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <h3 className="font-medium">Dark Pool Filters</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-muted-foreground">Min Notional Value</Label>
                      <span className="text-sm font-mono" data-testid="value-min-notional">
                        {formatCurrency(scannerConfig?.darkPoolMinNotional ?? 2000000)}
                      </span>
                    </div>
                    <Slider
                      value={[scannerConfig?.darkPoolMinNotional ?? 2000000]}
                      min={100000}
                      max={10000000}
                      step={100000}
                      onValueChange={([value]) => updateScannerMutation.mutate({ darkPoolMinNotional: value })}
                      data-testid="slider-min-notional"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-muted-foreground">Min % of 10-day ADV</Label>
                      <span className="text-sm font-mono" data-testid="value-min-adv">
                        {scannerConfig?.darkPoolMinAdvPercent ?? 5}%
                      </span>
                    </div>
                    <Slider
                      value={[scannerConfig?.darkPoolMinAdvPercent ?? 5]}
                      min={1}
                      max={20}
                      step={0.5}
                      onValueChange={([value]) => updateScannerMutation.mutate({ darkPoolMinAdvPercent: value })}
                      data-testid="slider-min-adv"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Include Block Trades</Label>
                    <Switch
                      checked={scannerConfig?.includeBlockTrades ?? true}
                      onCheckedChange={(checked) => updateScannerMutation.mutate({ includeBlockTrades: checked })}
                      data-testid="switch-block-trades"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Include Venue Imbalance</Label>
                    <Switch
                      checked={scannerConfig?.includeVenueImbalance ?? true}
                      onCheckedChange={(checked) => updateScannerMutation.mutate({ includeVenueImbalance: checked })}
                      data-testid="switch-venue-imbalance"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-warning" />
                  <h3 className="font-medium">Unusual Options Filters</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-muted-foreground">Min Premium</Label>
                      <span className="text-sm font-mono" data-testid="value-min-premium">
                        {formatCurrency(scannerConfig?.optionsMinPremium ?? 1000000)}
                      </span>
                    </div>
                    <Slider
                      value={[scannerConfig?.optionsMinPremium ?? 1000000]}
                      min={100000}
                      max={5000000}
                      step={100000}
                      onValueChange={([value]) => updateScannerMutation.mutate({ optionsMinPremium: value })}
                      data-testid="slider-min-premium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-muted-foreground">Min OI Change %</Label>
                      <span className="text-sm font-mono" data-testid="value-min-oi-change">
                        {scannerConfig?.optionsMinOiChangePercent ?? 500}%
                      </span>
                    </div>
                    <Slider
                      value={[scannerConfig?.optionsMinOiChangePercent ?? 500]}
                      min={100}
                      max={1000}
                      step={50}
                      onValueChange={([value]) => updateScannerMutation.mutate({ optionsMinOiChangePercent: value })}
                      data-testid="slider-min-oi-change"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-muted-foreground">Min Sweep Size</Label>
                      <span className="text-sm font-mono" data-testid="value-sweep-size">
                        {formatCurrency(scannerConfig?.optionsSweepMinSize ?? 500000)}
                      </span>
                    </div>
                    <Slider
                      value={[scannerConfig?.optionsSweepMinSize ?? 500000]}
                      min={100000}
                      max={2000000}
                      step={50000}
                      onValueChange={([value]) => updateScannerMutation.mutate({ optionsSweepMinSize: value })}
                      data-testid="slider-sweep-size"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Include Insider Filings</Label>
                    <Switch
                      checked={scannerConfig?.includeInsiderFilings ?? true}
                      onCheckedChange={(checked) => updateScannerMutation.mutate({ includeInsiderFilings: checked })}
                      data-testid="switch-insider-filings"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Include Catalyst Events</Label>
                    <Switch
                      checked={scannerConfig?.includeCatalystEvents ?? true}
                      onCheckedChange={(checked) => updateScannerMutation.mutate({ includeCatalystEvents: checked })}
                      data-testid="switch-catalyst-events"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                Last scan: {scannerConfig?.lastRun ? new Date(scannerConfig.lastRun).toLocaleString() : "Never"}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Refresh Interval:</Label>
                <select
                  value={scannerConfig?.refreshIntervalMs ?? 300000}
                  onChange={(e) => updateScannerMutation.mutate({ refreshIntervalMs: parseInt(e.target.value) })}
                  className="bg-background border border-border rounded-md px-2 py-1 text-sm"
                  data-testid="select-refresh-interval"
                >
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                  <option value={600000}>10 minutes</option>
                  <option value={900000}>15 minutes</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">API Key Status</h2>
          <Card data-testid="card-api-key-status">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                keyStatus.map((key, idx) => (
                  <div 
                    key={key.provider}
                    className={`p-4 flex items-center justify-between gap-3 ${idx !== keyStatus.length - 1 ? 'border-b border-border' : ''}`}
                    data-testid={`key-status-${key.provider}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${key.configured ? 'bg-positive/10' : 'bg-muted'}`}>
                        {key.configured ? (
                          <Check className="w-4 h-4 text-positive" />
                        ) : (
                          <Key className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{key.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{key.envVar}</p>
                      </div>
                    </div>
                    <Badge variant={key.configured ? "default" : "outline"}>
                      {key.configured ? "Configured" : "Missing"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Data Source Connectors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            [1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 w-full" />)
          ) : (
            connectors.map((connector) => (
              <Card key={connector.id} data-testid={`connector-${connector.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-card border border-border flex items-center justify-center">
                        {connector.provider === "twitter" ? (
                          <SiTwitter className="w-5 h-5" />
                        ) : connector.type === "market-data" ? (
                          <Database className="w-5 h-5 text-primary" />
                        ) : connector.type === "filings" ? (
                          <BarChart3 className="w-5 h-5 text-warning" />
                        ) : (
                          <Zap className="w-5 h-5 text-warning" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-sm" data-testid={`text-connector-name-${connector.id}`}>{connector.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusDot 
                            status={connector.status as "connected" | "disconnected" | "pending"} 
                            pulse={connector.status === "connected"}
                          />
                          <span className="text-xs text-muted-foreground capitalize">{connector.status}</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => testConnectorMutation.mutate(connector.id)}
                      disabled={testConnectorMutation.isPending}
                      data-testid={`button-test-${connector.id}`}
                    >
                      <RefreshCw className={`w-4 h-4 ${testConnectorMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last sync</span>
                      <span data-testid={`text-last-sync-${connector.id}`}>
                        {connector.lastSync ? new Date(connector.lastSync).toLocaleString() : "Never"}
                      </span>
                    </div>
                    {connector.lastError && (
                      <div className="text-xs text-destructive">
                        {connector.lastError}
                      </div>
                    )}
                  </div>

                  {connector.status === "disconnected" && (
                    <div className="mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => testConnectorMutation.mutate(connector.id)}
                        disabled={testConnectorMutation.isPending}
                        data-testid={`button-connect-${connector.id}`}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Connect
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
