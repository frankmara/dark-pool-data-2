import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIndicator, StatusDot } from "@/components/status-indicator";
import type { ApiConnector } from "@shared/schema";
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
  Twitter
} from "lucide-react";

const availableIntegrations = [
  { name: "Unusual Whales API", type: "Options Data", description: "Real-time unusual options activity" },
  { name: "Quiver Quant", type: "Alternative Data", description: "Congress trades, insider activity" },
  { name: "Alpaca Markets", type: "Trading", description: "Commission-free trading API" },
  { name: "Discord Webhook", type: "Notifications", description: "Send alerts to Discord" },
  { name: "Telegram Bot", type: "Notifications", description: "Send alerts to Telegram" },
];

export default function DataFeeds() {
  const { data: connectors = [], isLoading } = useQuery<ApiConnector[]>({
    queryKey: ['/api/connectors'],
  });

  const updateConnectorMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ApiConnector> }) => {
      return apiRequest('PATCH', `/api/connectors/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connectors'] });
    },
  });

  const connectedCount = connectors.filter(c => c.status === "connected").length;
  const pendingCount = connectors.filter(c => c.status === "pending").length;
  const disconnectedCount = connectors.filter(c => c.status === "disconnected").length;

  return (
    <div className="p-6 space-y-6 overflow-auto h-full" data-testid="page-data-feeds">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-data-feeds">Data Feeds & API Connectors</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your data sources and integrations</p>
        </div>
        <Button data-testid="button-add-connector">
          <Plus className="w-4 h-4 mr-2" />
          Add Connector
        </Button>
      </div>

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
        <Card data-testid="card-data-points">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="metric-data-points">147K</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Data Points/Day</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Active Connectors</h2>
          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (
            connectors.map((connector) => (
              <Card key={connector.id} data-testid={`connector-${connector.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-md bg-card border border-border flex items-center justify-center">
                        {connector.type === "social" ? (
                          <Twitter className="w-5 h-5" />
                        ) : connector.type === "market-data" ? (
                          <Database className="w-5 h-5 text-primary" />
                        ) : (
                          <Zap className="w-5 h-5 text-warning" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium" data-testid={`text-connector-name-${connector.id}`}>{connector.name}</h3>
                          <StatusDot 
                            status={connector.status as "connected" | "disconnected" | "pending"} 
                            pulse={connector.status === "connected"}
                          />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span data-testid={`text-last-sync-${connector.id}`}>
                            Last sync: {connector.lastSync ? new Date(connector.lastSync).toLocaleString() : "Never"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={connector.status as "connected" | "disconnected" | "pending"} size="sm" />
                      <Button variant="ghost" size="icon" data-testid={`button-settings-${connector.id}`}>
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-refresh-${connector.id}`}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {connector.status === "connected" && (
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          API Key: ••••••••
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Rate: Unlimited
                        </span>
                      </div>
                      <Switch 
                        defaultChecked 
                        data-testid={`switch-connector-${connector.id}`}
                        onCheckedChange={(checked) => {
                          updateConnectorMutation.mutate({
                            id: connector.id,
                            updates: { status: checked ? "connected" : "disconnected" }
                          });
                        }}
                      />
                    </div>
                  )}

                  {connector.status === "disconnected" && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        data-testid={`button-reconnect-${connector.id}`}
                        onClick={() => {
                          updateConnectorMutation.mutate({
                            id: connector.id,
                            updates: { status: "connected", lastSync: new Date().toISOString() }
                          });
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reconnect
                      </Button>
                    </div>
                  )}

                  {connector.status === "pending" && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Input placeholder="Enter webhook URL..." className="flex-1" data-testid={`input-webhook-${connector.id}`} />
                        <Button 
                          size="sm"
                          data-testid={`button-verify-${connector.id}`}
                          onClick={() => {
                            updateConnectorMutation.mutate({
                              id: connector.id,
                              updates: { status: "connected", lastSync: new Date().toISOString() }
                            });
                          }}
                        >
                          Verify
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Integrations</h2>
          <Card data-testid="card-available-integrations">
            <CardContent className="p-0">
              {availableIntegrations.map((integration, idx) => (
                <div 
                  key={idx}
                  className={`p-4 flex items-center justify-between gap-3 ${idx !== availableIntegrations.length - 1 ? 'border-b border-border' : ''}`}
                  data-testid={`available-integration-${idx}`}
                >
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-integration-name-${idx}`}>{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>
                  <Button variant="ghost" size="sm" data-testid={`button-add-integration-${idx}`}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card data-testid="card-api-key-management">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                API Key Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Twitter API Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="password" value="sk-••••••••••••••••" readOnly className="font-mono text-xs" data-testid="input-twitter-api-key" />
                  <Button variant="outline" size="icon" data-testid="button-edit-twitter-key">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dark Pool API Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="password" value="dp-••••••••••••••••" readOnly className="font-mono text-xs" data-testid="input-dark-pool-api-key" />
                  <Button variant="outline" size="icon" data-testid="button-edit-dark-pool-key">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" className="w-full" data-testid="button-manage-keys">
                Manage All Keys
              </Button>
            </CardContent>
          </Card>

          <Card data-testid="card-rate-limit-status">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rate Limit Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Twitter API</span>
                  <span className="font-mono" data-testid="text-twitter-rate">312/450</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-warning w-[69%] rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Options API</span>
                  <span className="font-mono" data-testid="text-options-rate">145/1000</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-positive w-[15%] rounded-full" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Rate limits reset every 15 minutes
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
