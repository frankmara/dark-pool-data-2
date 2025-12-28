import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ScrollArea 
} from "@/components/ui/scroll-area";
import type { SystemLog } from "@shared/schema";
import { 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Clock,
  ScanSearch,
  Send,
  Brain,
  ImageIcon,
  Activity,
  Filter
} from "lucide-react";
import { useState } from "react";

export default function OpsCenter() {
  const [filter, setFilter] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery<SystemLog[]>({
    queryKey: ['/api/logs'],
    refetchInterval: 10000,
  });

  const filteredLogs = filter 
    ? logs.filter(log => log.component === filter || log.status === filter)
    : logs;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-positive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'error': return <XCircle className="w-4 h-4 text-negative" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'success': return 'bg-positive/20 text-positive border-positive/30';
      case 'warning': return 'bg-warning/20 text-warning border-warning/30';
      case 'error': return 'bg-negative/20 text-negative border-negative/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'scanner': return ScanSearch;
      case 'llm_agent': return Brain;
      case 'chart_gen': return ImageIcon;
      case 'poster': return Send;
      default: return Activity;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const componentCounts = logs.reduce((acc, log) => {
    acc[log.component] = (acc[log.component] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusCounts = logs.reduce((acc, log) => {
    acc[log.status] = (acc[log.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6 overflow-auto h-full" data-testid="page-ops-center">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-ops-center">Operations Center</h1>
          <p className="text-muted-foreground text-sm mt-1">System logs and event monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs gap-1.5" data-testid="badge-log-count">
            <FileText className="w-3 h-3" />
            {logs.length} events
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-logs">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer hover-elevate ${filter === null ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter(null)}
          data-testid="filter-all"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">All Events</p>
              <p className="text-2xl font-semibold font-mono">{logs.length}</p>
            </div>
            <Activity className="w-8 h-8 text-muted-foreground opacity-50" />
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${filter === 'success' ? 'ring-2 ring-positive' : ''}`}
          onClick={() => setFilter(filter === 'success' ? null : 'success')}
          data-testid="filter-success"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Success</p>
              <p className="text-2xl font-semibold font-mono text-positive">{statusCounts['success'] || 0}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-positive opacity-50" />
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${filter === 'warning' ? 'ring-2 ring-warning' : ''}`}
          onClick={() => setFilter(filter === 'warning' ? null : 'warning')}
          data-testid="filter-warning"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Warnings</p>
              <p className="text-2xl font-semibold font-mono text-warning">{statusCounts['warning'] || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-warning opacity-50" />
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${filter === 'error' ? 'ring-2 ring-negative' : ''}`}
          onClick={() => setFilter(filter === 'error' ? null : 'error')}
          data-testid="filter-error"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-2xl font-semibold font-mono text-negative">{statusCounts['error'] || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-negative opacity-50" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3" data-testid="card-event-log">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Event Log</CardTitle>
                <p className="text-xs text-muted-foreground">Last 100 system events</p>
              </div>
            </div>
            {filter && (
              <Badge variant="outline" className="gap-1">
                <Filter className="w-3 h-3" />
                {filter}
                <button 
                  onClick={() => setFilter(null)} 
                  className="ml-1 hover:text-foreground"
                  data-testid="button-clear-filter"
                >
                  x
                </button>
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground" data-testid="empty-state-logs">
                <FileText className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No events found</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredLogs.map((log) => {
                    const ComponentIcon = getComponentIcon(log.component);
                    return (
                      <div 
                        key={log.id}
                        className="p-3 rounded-md bg-muted/50 hover-elevate"
                        data-testid={`log-item-${log.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {getStatusIcon(log.status)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{log.eventType.replace(/_/g, ' ')}</span>
                                <Badge variant="outline" className="text-xs gap-1">
                                  <ComponentIcon className="w-3 h-3" />
                                  {log.component}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 truncate" title={log.message || ''}>
                                {log.message || 'No message'}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="outline" className={`text-xs ${getStatusBadgeClass(log.status)}`}>
                              {log.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-component-breakdown">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">By Component</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {Object.entries(componentCounts).map(([component, count]) => {
              const ComponentIcon = getComponentIcon(component);
              return (
                <div 
                  key={component}
                  className={`p-3 rounded-md bg-muted/50 flex items-center justify-between cursor-pointer hover-elevate ${filter === component ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setFilter(filter === component ? null : component)}
                  data-testid={`component-filter-${component}`}
                >
                  <div className="flex items-center gap-2">
                    <ComponentIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm capitalize">{component.replace(/_/g, ' ')}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
