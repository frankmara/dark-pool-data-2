import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/metric-card";
import { DataTable, SentimentBadge, FlowIndicator, TickerCell } from "@/components/data-table";
import { StatusIndicator, StatusDot } from "@/components/status-indicator";
import type { DarkPoolData, UnusualOptions, Post } from "@shared/schema";
import { 
  ScanSearch, 
  TrendingUp, 
  MessageSquare, 
  Clock, 
  RefreshCw,
  ExternalLink,
  Activity,
  Zap,
  Eye
} from "lucide-react";

interface AutomationToggles {
  masterEnabled: boolean;
  darkPoolScanner: boolean;
  unusualOptionsSweeps: boolean;
  autoThreadPosting: boolean;
  analyticsTracking: boolean;
}

interface LiveAutomationsProps {
  toggles: AutomationToggles;
}

const darkPoolColumns = [
  { 
    key: "ticker", 
    label: "Ticker",
    render: (value: string, row: DarkPoolData) => <TickerCell ticker={value} price={row.price || undefined} />
  },
  { 
    key: "volume", 
    label: "Volume",
    render: (value: number, row: DarkPoolData) => <FlowIndicator type={row.flowType || ""} volume={value} />
  },
  { 
    key: "sentiment", 
    label: "Sentiment",
    render: (value: string) => <SentimentBadge sentiment={value} />
  },
  { key: "flowType", label: "Flow Type" },
  { 
    key: "timestamp", 
    label: "Time", 
    align: "right" as const,
    render: (value: string) => {
      if (!value) return "-";
      const date = new Date(value);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      return `${Math.floor(diffSec / 3600)}h ago`;
    }
  },
];

const optionsColumns = [
  { 
    key: "ticker", 
    label: "Ticker",
    render: (value: string) => <span className="font-semibold" data-testid={`text-ticker-${value}`}>{value}</span>
  },
  { key: "strike", label: "Strike", render: (v: string) => `$${v}` },
  { key: "expiry", label: "Expiry" },
  { 
    key: "type", 
    label: "Type",
    render: (value: string) => (
      <Badge 
        variant="outline" 
        className={value === "CALL" ? "bg-positive/20 text-positive border-positive/30" : "bg-negative/20 text-negative border-negative/30"}
        data-testid={`badge-option-type-${value}`}
      >
        {value}
      </Badge>
    )
  },
  { key: "premium", label: "Premium", align: "right" as const },
  { key: "volume", label: "Vol", align: "right" as const, render: (v: number) => v.toLocaleString() },
];

export default function LiveAutomations({ toggles }: LiveAutomationsProps) {
  const { data: darkPoolData = [], isLoading: darkPoolLoading } = useQuery<DarkPoolData[]>({
    queryKey: ['/api/dark-pool'],
    enabled: toggles.darkPoolScanner && toggles.masterEnabled,
    refetchInterval: 5000,
  });

  const { data: optionsData = [], isLoading: optionsLoading } = useQuery<UnusualOptions[]>({
    queryKey: ['/api/unusual-options'],
    enabled: toggles.unusualOptionsSweeps && toggles.masterEnabled,
    refetchInterval: 5000,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ['/api/posts'],
    refetchInterval: 10000,
  });

  const recentPosts = posts.slice(0, 3);

  return (
    <div className="p-6 space-y-6 overflow-auto h-full" data-testid="page-live-automations">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-live-automations">Live Automations Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time monitoring of all active automations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs gap-1.5" data-testid="badge-last-update">
            <Clock className="w-3 h-3" />
            Last update: 2s ago
          </Badge>
          <Button variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          label="Dark Pool Signals" 
          value={darkPoolData.length.toString()} 
          change={12.5} 
          changeLabel="vs yesterday"
          trend="up"
          icon={ScanSearch}
        />
        <MetricCard 
          label="Options Sweeps" 
          value={optionsData.length.toString()} 
          change={-5.2} 
          changeLabel="vs yesterday"
          trend="down"
          icon={TrendingUp}
        />
        <MetricCard 
          label="Posts Today" 
          value={posts.filter(p => p.status === "posted").length.toString()} 
          change={33.3} 
          changeLabel="vs yesterday"
          trend="up"
          icon={MessageSquare}
        />
        <MetricCard 
          label="Engagement Rate" 
          value="7.8%" 
          change={2.1} 
          changeLabel="vs avg"
          trend="up"
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" data-testid="card-dark-pool-scanner">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <ScanSearch className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Dark Pool Scanner</CardTitle>
                <p className="text-xs text-muted-foreground">Institutional block trades</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status={toggles.darkPoolScanner && toggles.masterEnabled ? "active" : "inactive"} pulse={toggles.darkPoolScanner && toggles.masterEnabled} />
              <StatusIndicator 
                status={toggles.darkPoolScanner && toggles.masterEnabled ? "active" : "inactive"} 
                label={toggles.darkPoolScanner && toggles.masterEnabled ? "Scanning" : "Paused"}
                size="sm"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {darkPoolLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : toggles.darkPoolScanner && toggles.masterEnabled ? (
              <DataTable columns={darkPoolColumns} data={darkPoolData} />
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground" data-testid="empty-state-dark-pool">
                <ScanSearch className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Dark Pool Scanner is paused</p>
                <p className="text-xs">Enable the scanner to see live data</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-automation-status">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-positive/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-positive" />
              </div>
              <div>
                <CardTitle className="text-base">Automation Status</CardTitle>
                <p className="text-xs text-muted-foreground">Active processes</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50" data-testid="status-item-dark-pool">
              <div className="flex items-center gap-3">
                <ScanSearch className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Dark Pool Scanner</span>
              </div>
              <StatusIndicator 
                status={toggles.darkPoolScanner && toggles.masterEnabled ? "active" : "inactive"} 
                showIcon={false}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50" data-testid="status-item-options">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Options Monitor</span>
              </div>
              <StatusIndicator 
                status={toggles.unusualOptionsSweeps && toggles.masterEnabled ? "active" : "inactive"} 
                showIcon={false}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50" data-testid="status-item-auto-thread">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Auto-Thread Posting</span>
              </div>
              <StatusIndicator 
                status={toggles.autoThreadPosting && toggles.masterEnabled ? "active" : "inactive"} 
                showIcon={false}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50" data-testid="status-item-analytics">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Analytics Tracking</span>
              </div>
              <StatusIndicator 
                status="active" 
                label="Always On"
                showIcon={false}
                size="sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-unusual-options">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-warning" />
              </div>
              <div>
                <CardTitle className="text-base">Unusual Options Sweeps</CardTitle>
                <p className="text-xs text-muted-foreground">High-premium activity</p>
              </div>
            </div>
            <StatusIndicator 
              status={toggles.unusualOptionsSweeps && toggles.masterEnabled ? "active" : "inactive"} 
              label={toggles.unusualOptionsSweeps && toggles.masterEnabled ? "Monitoring" : "Paused"}
              size="sm"
            />
          </CardHeader>
          <CardContent className="pt-0">
            {optionsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : toggles.unusualOptionsSweeps && toggles.masterEnabled ? (
              <DataTable columns={optionsColumns} data={optionsData} />
            ) : (
              <div className="h-36 flex flex-col items-center justify-center text-muted-foreground" data-testid="empty-state-options">
                <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Options Monitor is paused</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-recent-posts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Recent Posts</CardTitle>
                <p className="text-xs text-muted-foreground">Latest automated content</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" data-testid="button-view-all-posts">
              View All
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {postsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="h-36 flex flex-col items-center justify-center text-muted-foreground" data-testid="empty-state-posts">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No posts yet</p>
              </div>
            ) : (
              recentPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                  data-testid={`post-item-${post.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm line-clamp-2 flex-1" data-testid={`text-post-content-${post.id}`}>{post.content}</p>
                    <Badge 
                      variant="outline" 
                      className={post.status === "posted" ? "bg-positive/20 text-positive border-positive/30" : "bg-primary/20 text-primary border-primary/30"}
                      data-testid={`badge-post-status-${post.id}`}
                    >
                      {post.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1" data-testid={`text-impressions-${post.id}`}>
                      <Eye className="w-3 h-3" />
                      {(post.impressions || 0).toLocaleString()}
                    </span>
                    <span data-testid={`text-engagement-${post.id}`}>
                      Eng: {post.engagements && post.impressions ? ((post.engagements / post.impressions) * 100).toFixed(1) + "%" : "-"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
