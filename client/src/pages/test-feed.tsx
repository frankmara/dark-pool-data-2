import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TestPost, TestModeSettings } from "@shared/schema";
import {
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Clock
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INTERVALS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
];

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

interface TweetCardProps {
  post: TestPost;
}

function TweetCard({ post }: TweetCardProps) {
  const thread = post.thread as any[];
  const engagement = post.engagement as any;
  const chartSvg = (post as any).chartSvg as string | undefined;
  const flowSummarySvg = (post as any).flowSummarySvg as string | undefined;
  const isLiveData = (post as any).isLiveData as boolean | undefined;
  
  const getSentimentIcon = () => {
    switch (post.sentiment) {
      case 'bullish': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'bearish': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getConvictionColor = () => {
    switch (post.conviction) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="border-b border-border" data-testid={`test-post-${post.id}`}>
      {thread.map((tweet, idx) => (
        <div key={idx} className="p-4 hover-elevate">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">DP</span>
              </div>
              {idx < thread.length - 1 && (
                <div className="w-0.5 flex-1 bg-border mt-2" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">Dark Pool Data</span>
                <span className="text-muted-foreground text-sm">@darkpooldata</span>
                <span className="text-muted-foreground text-sm">·</span>
                <span className="text-muted-foreground text-sm">{formatTimeAgo(post.generatedAt)}</span>
                {idx === 0 && (
                  <>
                    {isLiveData && (
                      <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        LIVE
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-xs ml-auto ${getConvictionColor()}`}>
                      {post.conviction?.toUpperCase()}
                    </Badge>
                    {getSentimentIcon()}
                  </>
                )}
              </div>
              
              {idx === 0 && (
                <div className="flex items-center gap-2 mt-1 mb-2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    ${post.ticker}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {post.eventType === 'dark_pool' ? 'Dark Pool' : 'Options Sweep'}
                  </Badge>
                </div>
              )}
              
              <p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap">
                {tweet.content}
              </p>
              
              {idx === 0 && chartSvg && (
                <div 
                  className="mt-3 rounded-lg border border-border overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: chartSvg }}
                  data-testid="chart-image"
                />
              )}
              
              {idx === 1 && flowSummarySvg && (
                <div 
                  className="mt-3 rounded-lg border border-border overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: flowSummarySvg }}
                  data-testid="flow-summary-image"
                />
              )}
              
              {idx === 0 && (
                <div className="flex items-center gap-6 mt-3 text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-primary transition-colors" data-testid="button-reply">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-xs">{formatNumber(engagement?.replies || 0)}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-emerald-500 transition-colors" data-testid="button-retweet">
                    <Repeat2 className="w-4 h-4" />
                    <span className="text-xs">{formatNumber(engagement?.retweets || 0)}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-red-500 transition-colors" data-testid="button-like">
                    <Heart className="w-4 h-4" />
                    <span className="text-xs">{formatNumber(engagement?.likes || 0)}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-primary transition-colors" data-testid="button-bookmark">
                    <Bookmark className="w-4 h-4" />
                    <span className="text-xs">{formatNumber(engagement?.bookmarks || 0)}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-primary transition-colors" data-testid="button-views">
                    <Eye className="w-4 h-4" />
                    <span className="text-xs">{formatNumber(engagement?.impressions || 0)}</span>
                  </button>
                  <button className="hover:text-primary transition-colors ml-auto" data-testid="button-share">
                    <Share className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TestFeed() {
  const { toast } = useToast();
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState("30");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(0);

  const { data: posts = [], isLoading: postsLoading } = useQuery<TestPost[]>({
    queryKey: ['/api/test-mode/posts'],
    refetchInterval: autoGenerate ? 5000 : false,
  });

  const { data: settings } = useQuery<TestModeSettings>({
    queryKey: ['/api/test-mode/settings'],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/test-mode/generate');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-mode/posts'] });
      toast({ title: "Post generated", description: "New test post added to feed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate post", variant: "destructive" });
    }
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', '/api/test-mode/posts');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-mode/posts'] });
      toast({ title: "Feed cleared", description: "All test posts removed" });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<TestModeSettings>) => {
      return apiRequest('PATCH', '/api/test-mode/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-mode/settings'] });
    }
  });

  useEffect(() => {
    if (autoGenerate) {
      const intervalMs = parseInt(intervalMinutes) * 60 * 1000;
      setCountdown(parseInt(intervalMinutes) * 60);
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return parseInt(intervalMinutes) * 60;
          }
          return prev - 1;
        });
      }, 1000);
      
      intervalRef.current = setInterval(() => {
        generateMutation.mutate();
      }, intervalMs);
      
      updateSettingsMutation.mutate({ 
        enabled: true, 
        intervalMinutes: parseInt(intervalMinutes),
        autoGenerate: true 
      });

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        clearInterval(countdownInterval);
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCountdown(0);
      updateSettingsMutation.mutate({ enabled: false, autoGenerate: false });
    }
  }, [autoGenerate, intervalMinutes]);

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full" data-testid="page-test-feed">
      <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Test Feed
              </h1>
              <p className="text-muted-foreground text-sm">Preview generated posts (not published)</p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Select value={intervalMinutes} onValueChange={setIntervalMinutes} disabled={autoGenerate}>
                  <SelectTrigger className="w-32" data-testid="select-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map(i => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
                <span className="text-sm text-muted-foreground">Auto</span>
                <Switch 
                  checked={autoGenerate} 
                  onCheckedChange={setAutoGenerate}
                  data-testid="switch-auto-generate"
                />
                {autoGenerate && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {formatCountdown(countdown)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <Separator className="my-3" />
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => generateMutation.mutate()} 
              disabled={generateMutation.isPending}
              data-testid="button-generate-post"
            >
              {generateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : autoGenerate ? (
                <Play className="w-4 h-4 mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Generate Post
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending || posts.length === 0}
              data-testid="button-clear-feed"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Feed
            </Button>
            
            <div className="ml-auto text-sm text-muted-foreground">
              {posts.length} posts in feed
            </div>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {postsLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No test posts yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Click "Generate Post" or enable auto-generation to start
            </p>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <Zap className="w-4 h-4 mr-2" />
              Generate First Post
            </Button>
          </div>
        ) : (
          <div>
            {posts.map(post => (
              <TweetCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
