import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import type { Post } from "@shared/schema";
import { 
  BarChart3, 
  Eye, 
  Heart, 
  MessageCircle, 
  Repeat2, 
  MousePointer,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const mockHourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  impressions: Math.floor(Math.random() * 5000) + 1000,
  engagements: Math.floor(Math.random() * 500) + 100,
}));

export default function PostAnalytics() {
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ['/api/posts'],
  });

  const totalImpressions = posts.reduce((sum, p) => sum + (p.impressions || 0), 0);
  const totalEngagements = posts.reduce((sum, p) => sum + (p.engagements || 0), 0);
  const totalClicks = posts.reduce((sum, p) => sum + (p.clicks || 0), 0);
  const avgEngagement = totalImpressions > 0 ? ((totalEngagements / totalImpressions) * 100).toFixed(1) : "0";

  const performanceColumns = [
    { 
      key: "content", 
      label: "Post Content",
      render: (value: string) => (
        <span className="line-clamp-1 max-w-xs">{value}</span>
      )
    },
    { 
      key: "impressions", 
      label: "Impressions",
      align: "right" as const,
      render: (value: number) => (
        <span className="font-mono">{(value || 0).toLocaleString()}</span>
      )
    },
    { 
      key: "engagements", 
      label: "Engagements",
      align: "right" as const,
      render: (value: number) => (
        <span className="font-mono text-positive">{(value || 0).toLocaleString()}</span>
      )
    },
    { 
      key: "clicks", 
      label: "Clicks",
      align: "right" as const,
      render: (value: number) => (
        <span className="font-mono">{(value || 0).toLocaleString()}</span>
      )
    },
    { 
      key: "status", 
      label: "Status",
      align: "right" as const,
      render: (value: string) => (
        <Badge 
          variant="outline" 
          className={value === "posted" ? "bg-positive/20 text-positive border-positive/30" : ""}
        >
          {value}
        </Badge>
      )
    },
  ];

  return (
    <div className="p-6 space-y-6 overflow-auto h-full" data-testid="page-post-analytics">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-post-analytics">Post Analytics Suite</h1>
          <p className="text-muted-foreground text-sm mt-1">Performance metrics and engagement analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="7d">
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          <>
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </>
        ) : (
          <>
            <MetricCard 
              label="Total Impressions" 
              value={totalImpressions > 1000 ? `${(totalImpressions/1000).toFixed(1)}K` : totalImpressions.toString()} 
              change={18.5} 
              changeLabel="vs last week"
              trend="up"
              icon={Eye}
            />
            <MetricCard 
              label="Engagements" 
              value={totalEngagements > 1000 ? `${(totalEngagements/1000).toFixed(1)}K` : totalEngagements.toString()} 
              change={12.2} 
              changeLabel="vs last week"
              trend="up"
              icon={Heart}
            />
            <MetricCard 
              label="Link Clicks" 
              value={totalClicks > 1000 ? `${(totalClicks/1000).toFixed(1)}K` : totalClicks.toString()} 
              change={-3.8} 
              changeLabel="vs last week"
              trend="down"
              icon={MousePointer}
            />
            <MetricCard 
              label="Avg Engagement" 
              value={`${avgEngagement}%`} 
              change={0.5} 
              changeLabel="vs last week"
              trend="up"
              icon={TrendingUp}
            />
            <MetricCard 
              label="Total Posts" 
              value={posts.length.toString()} 
              change={15} 
              changeLabel="vs last week"
              trend="up"
              icon={MessageCircle}
            />
          </>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-analytics">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="posts" data-testid="tab-posts">Post Performance</TabsTrigger>
          <TabsTrigger value="timing" data-testid="tab-timing">Best Times</TabsTrigger>
          <TabsTrigger value="topics" data-testid="tab-topics">Topic Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-engagement-trend">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Engagement Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-1 px-2">
                  {Array.from({ length: 14 }, (_, i) => {
                    const height = Math.random() * 80 + 20;
                    return (
                      <div 
                        key={i} 
                        className="flex-1 bg-primary/80 rounded-t-sm hover:bg-primary transition-colors"
                        style={{ height: `${height}%` }}
                        data-testid={`bar-${i}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Dec 14</span>
                  <span>Dec 21</span>
                  <span>Dec 28</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-top-topics">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-positive" />
                  Top Performing Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { topic: "Dark Pool Analysis", posts: 18, avgEngagement: "9.2%", trend: "up" },
                  { topic: "Options Flow", posts: 15, avgEngagement: "8.5%", trend: "up" },
                  { topic: "Institutional Activity", posts: 8, avgEngagement: "7.8%", trend: "neutral" },
                  { topic: "Market Alerts", posts: 6, avgEngagement: "6.2%", trend: "down" },
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`topic-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium" data-testid={`text-topic-name-${idx}`}>{item.topic}</p>
                        <p className="text-xs text-muted-foreground">{item.posts} posts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono ${item.trend === "up" ? "text-positive" : item.trend === "down" ? "text-negative" : "text-muted-foreground"}`}>
                        {item.avgEngagement}
                      </span>
                      {item.trend === "up" && <TrendingUp className="w-3 h-3 text-positive" />}
                      {item.trend === "down" && <TrendingDown className="w-3 h-3 text-negative" />}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-engagement-breakdown">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base">Engagement Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-md bg-muted/50 text-center" data-testid="metric-likes">
                  <Heart className="w-5 h-5 mx-auto mb-2 text-negative" />
                  <p className="text-2xl font-bold font-mono">{posts.reduce((sum, p) => sum + (p.likes || 0), 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Likes</p>
                </div>
                <div className="p-4 rounded-md bg-muted/50 text-center" data-testid="metric-retweets">
                  <Repeat2 className="w-5 h-5 mx-auto mb-2 text-positive" />
                  <p className="text-2xl font-bold font-mono">{posts.reduce((sum, p) => sum + (p.retweets || 0), 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Retweets</p>
                </div>
                <div className="p-4 rounded-md bg-muted/50 text-center" data-testid="metric-replies">
                  <MessageCircle className="w-5 h-5 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold font-mono">{posts.reduce((sum, p) => sum + (p.replies || 0), 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Replies</p>
                </div>
                <div className="p-4 rounded-md bg-muted/50 text-center" data-testid="metric-total-clicks">
                  <MousePointer className="w-5 h-5 mx-auto mb-2 text-warning" />
                  <p className="text-2xl font-bold font-mono">{totalClicks.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Clicks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts">
          <Card data-testid="card-posts-table">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base">All Posts Performance</CardTitle>
              <Button variant="outline" size="sm" data-testid="button-filter">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <DataTable columns={performanceColumns} data={posts} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing">
          <Card data-testid="card-best-times">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Best Times to Post
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-1" data-testid="heatmap-hours">
                  {mockHourlyData.map((data, idx) => {
                    const intensity = Math.min(data.engagements / 500, 1);
                    return (
                      <div
                        key={idx}
                        className="aspect-square rounded-sm flex items-center justify-center text-[10px] font-mono"
                        style={{
                          backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                        }}
                        title={`${data.hour}:00 - ${data.engagements} engagements`}
                        data-testid={`hour-${idx}`}
                      >
                        {data.hour}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Lower engagement</span>
                  <div className="flex items-center gap-1">
                    {[0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
                      <div
                        key={intensity}
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: `rgba(59, 130, 246, ${intensity})` }}
                      />
                    ))}
                  </div>
                  <span>Higher engagement</span>
                </div>
                <div className="mt-6 p-4 rounded-md bg-positive/10 border border-positive/20" data-testid="best-times-recommendation">
                  <p className="text-sm font-medium text-positive">Best posting times identified:</p>
                  <p className="text-xs text-muted-foreground mt-1">9:30 AM, 12:00 PM, 3:00 PM EST - Market hours show highest engagement</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics">
          <Card data-testid="card-topic-performance">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Topic Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { topic: "Dark Pool", percentage: 85, color: "bg-primary" },
                  { topic: "Options Flow", percentage: 72, color: "bg-positive" },
                  { topic: "Institutional", percentage: 65, color: "bg-warning" },
                  { topic: "Technical Analysis", percentage: 48, color: "bg-muted-foreground" },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-2" data-testid={`topic-bar-${idx}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.topic}</span>
                      <span className="font-mono text-muted-foreground">{item.percentage}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
