import { 
  type User, type InsertUser,
  type AutomationSettings, type InsertAutomationSettings,
  type Post, type InsertPost,
  type DarkPoolData, type InsertDarkPoolData,
  type UnusualOptions, type InsertUnusualOptions,
  type WorkflowNode, type InsertWorkflowNode,
  type WorkflowConnection, type InsertWorkflowConnection,
  type ApiConnector, type InsertApiConnector,
  type AnalyticsData, type InsertAnalyticsData,
  type ScannerConfig, type InsertScannerConfig,
  type MarketEvent, type InsertMarketEvent,
  type SystemLog, type InsertSystemLog,
  type NotificationChannel, type InsertNotificationChannel,
  type AlertRule, type InsertAlertRule,
  type HealthSnapshot, type InsertHealthSnapshot,
  type TestPost, type InsertTestPost,
  type TestModeSettings, type InsertTestModeSettings,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAutomationSettings(): Promise<AutomationSettings | undefined>;
  updateAutomationSettings(settings: Partial<InsertAutomationSettings>): Promise<AutomationSettings>;
  
  getPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, post: Partial<InsertPost>): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
  
  getDarkPoolData(): Promise<DarkPoolData[]>;
  createDarkPoolData(data: InsertDarkPoolData): Promise<DarkPoolData>;
  
  getUnusualOptions(): Promise<UnusualOptions[]>;
  createUnusualOptions(data: InsertUnusualOptions): Promise<UnusualOptions>;
  
  getWorkflowNodes(): Promise<WorkflowNode[]>;
  createWorkflowNode(node: InsertWorkflowNode): Promise<WorkflowNode>;
  updateWorkflowNode(id: string, node: Partial<InsertWorkflowNode>): Promise<WorkflowNode | undefined>;
  deleteWorkflowNode(id: string): Promise<boolean>;
  
  getWorkflowConnections(): Promise<WorkflowConnection[]>;
  createWorkflowConnection(connection: InsertWorkflowConnection): Promise<WorkflowConnection>;
  deleteWorkflowConnection(id: string): Promise<boolean>;
  
  getApiConnectors(): Promise<ApiConnector[]>;
  getApiConnector(id: string): Promise<ApiConnector | undefined>;
  getApiConnectorByProvider(provider: string): Promise<ApiConnector | undefined>;
  createApiConnector(connector: InsertApiConnector): Promise<ApiConnector>;
  updateApiConnector(id: string, connector: Partial<InsertApiConnector>): Promise<ApiConnector | undefined>;
  
  getAnalyticsData(period?: string): Promise<AnalyticsData[]>;
  createAnalyticsData(data: InsertAnalyticsData): Promise<AnalyticsData>;

  getScannerConfig(): Promise<ScannerConfig | undefined>;
  updateScannerConfig(config: Partial<InsertScannerConfig>): Promise<ScannerConfig>;

  getMarketEvents(filters?: { eventType?: string; ticker?: string; limit?: number }): Promise<MarketEvent[]>;
  createMarketEvent(event: InsertMarketEvent): Promise<MarketEvent>;
  clearMarketEvents(): Promise<void>;

  getSystemLogs(limit?: number): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;

  getNotificationChannels(): Promise<NotificationChannel[]>;
  createNotificationChannel(channel: InsertNotificationChannel): Promise<NotificationChannel>;
  updateNotificationChannel(id: string, channel: Partial<InsertNotificationChannel>): Promise<NotificationChannel | undefined>;
  deleteNotificationChannel(id: string): Promise<boolean>;

  getAlertRules(): Promise<AlertRule[]>;
  createAlertRule(rule: InsertAlertRule): Promise<AlertRule>;
  updateAlertRule(id: string, rule: Partial<InsertAlertRule>): Promise<AlertRule | undefined>;

  getHealthSnapshots(): Promise<HealthSnapshot[]>;
  updateHealthSnapshot(component: string, snapshot: Partial<InsertHealthSnapshot>): Promise<HealthSnapshot>;

  getTestPosts(limit?: number): Promise<TestPost[]>;
  createTestPost(post: InsertTestPost): Promise<TestPost>;
  clearTestPosts(): Promise<void>;

  getTestModeSettings(): Promise<TestModeSettings | undefined>;
  updateTestModeSettings(settings: Partial<InsertTestModeSettings>): Promise<TestModeSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private automationSettings: AutomationSettings | undefined;
  private posts: Map<string, Post>;
  private darkPoolData: Map<string, DarkPoolData>;
  private unusualOptions: Map<string, UnusualOptions>;
  private workflowNodes: Map<string, WorkflowNode>;
  private workflowConnections: Map<string, WorkflowConnection>;
  private apiConnectors: Map<string, ApiConnector>;
  private analyticsData: Map<string, AnalyticsData>;
  private scannerConfig: ScannerConfig | undefined;
  private marketEvents: Map<string, MarketEvent>;
  private systemLogs: Map<string, SystemLog>;
  private notificationChannels: Map<string, NotificationChannel>;
  private alertRules: Map<string, AlertRule>;
  private healthSnapshots: Map<string, HealthSnapshot>;
  private testPosts: Map<string, TestPost>;
  private testModeSettings: TestModeSettings | undefined;

  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.darkPoolData = new Map();
    this.unusualOptions = new Map();
    this.workflowNodes = new Map();
    this.workflowConnections = new Map();
    this.apiConnectors = new Map();
    this.analyticsData = new Map();
    this.marketEvents = new Map();
    this.systemLogs = new Map();
    this.notificationChannels = new Map();
    this.alertRules = new Map();
    this.healthSnapshots = new Map();
    this.testPosts = new Map();
    
    this.seedData();
  }

  private seedData() {
    this.automationSettings = {
      id: randomUUID(),
      masterEnabled: true,
      darkPoolScanner: true,
      unusualOptionsSweeps: true,
      autoThreadPosting: false,
      analyticsTracking: true,
    };

    this.scannerConfig = {
      id: randomUUID(),
      name: "Master Dark Pool & Unusual Options Scanner",
      enabled: true,
      refreshIntervalMs: 300000,
      darkPoolMinNotional: 2000000,
      darkPoolMinAdvPercent: 5,
      optionsMinPremium: 1000000,
      optionsMinOiChangePercent: 500,
      optionsSweepMinSize: 500000,
      includeBlockTrades: true,
      includeVenueImbalance: true,
      includeInsiderFilings: true,
      includeCatalystEvents: true,
      lastRun: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const darkPoolItems: InsertDarkPoolData[] = [
      { ticker: "NVDA", volume: 2500000, price: "875.50", sentiment: "Bullish", flowType: "Accumulation", timestamp: new Date().toISOString() },
      { ticker: "AAPL", volume: 1800000, price: "178.25", sentiment: "Neutral", flowType: "Distribution", timestamp: new Date().toISOString() },
      { ticker: "TSLA", volume: 3200000, price: "245.80", sentiment: "Bullish", flowType: "Accumulation", timestamp: new Date().toISOString() },
      { ticker: "AMD", volume: 1500000, price: "165.30", sentiment: "Bearish", flowType: "Distribution", timestamp: new Date().toISOString() },
      { ticker: "META", volume: 980000, price: "485.20", sentiment: "Bullish", flowType: "Accumulation", timestamp: new Date().toISOString() },
    ];

    darkPoolItems.forEach(item => {
      const id = randomUUID();
      this.darkPoolData.set(id, { id, ...item });
    });

    const optionsItems: InsertUnusualOptions[] = [
      { ticker: "SPY", strike: "475", expiry: "Jan 19", type: "CALL", premium: "2.5M", volume: 15000, openInterest: 45000, timestamp: new Date().toISOString() },
      { ticker: "QQQ", strike: "410", expiry: "Jan 26", type: "PUT", premium: "1.8M", volume: 12000, openInterest: 32000, timestamp: new Date().toISOString() },
      { ticker: "NVDA", strike: "900", expiry: "Feb 16", type: "CALL", premium: "4.2M", volume: 8500, openInterest: 28000, timestamp: new Date().toISOString() },
      { ticker: "AAPL", strike: "185", expiry: "Jan 19", type: "CALL", premium: "890K", volume: 6200, openInterest: 18000, timestamp: new Date().toISOString() },
    ];

    optionsItems.forEach(item => {
      const id = randomUUID();
      this.unusualOptions.set(id, { id, ...item });
    });

    const connectors: InsertApiConnector[] = [
      { name: "Unusual Whales API", type: "market-data", provider: "unusual_whales", status: "disconnected", lastSync: null, config: { scope: "full_access" } },
      { name: "X/Twitter API v2", type: "social", provider: "twitter", status: "disconnected", lastSync: null, config: { scope: "read_write_analytics" } },
      { name: "Polygon.io", type: "market-data", provider: "polygon", status: "disconnected", lastSync: null, config: { scope: "stocks_options" } },
      { name: "Alpha Vantage", type: "market-data", provider: "alpha_vantage", status: "disconnected", lastSync: null, config: { scope: "fundamentals" } },
      { name: "Financial Modeling Prep", type: "market-data", provider: "fmp", status: "disconnected", lastSync: null, config: { scope: "all" } },
      { name: "SEC EDGAR", type: "filings", provider: "sec_edgar", status: "connected", lastSync: new Date().toISOString(), config: { scope: "insider_filings" } },
    ];

    connectors.forEach(connector => {
      const id = randomUUID();
      this.apiConnectors.set(id, { id, ...connector, lastError: null, rateLimitRemaining: null, rateLimitReset: null });
    });

    const posts: InsertPost[] = [
      { content: "NVDA seeing massive dark pool accumulation...", variant: "A", status: "posted", impressions: 12500, engagements: 1025, clicks: 350 },
      { content: "Unusual SPY 475C sweep detected...", variant: "A", status: "posted", impressions: 8900, engagements: 578, clicks: 223 },
      { content: "Thread: Institutional flow analysis...", variant: "A", status: "scheduled", impressions: 0, engagements: 0, clicks: 0 },
    ];

    posts.forEach(post => {
      const id = randomUUID();
      this.posts.set(id, { id, ...post, retweets: 0, likes: 0, replies: 0, scheduledAt: null, postedAt: null, tags: null });
    });

    const workflowNodes: InsertWorkflowNode[] = [
      { label: "Master Scanner", type: "trigger", icon: "Radar", color: "primary", positionX: 100, positionY: 200, active: true, config: { nodeType: "master_scanner" } },
      { label: "Dark Pool Scanner", type: "trigger", icon: "ScanSearch", color: "primary", positionX: 350, positionY: 120, active: true },
      { label: "Options Flow", type: "trigger", icon: "TrendingUp", color: "warning", positionX: 350, positionY: 280, active: true },
      { label: "Volume Filter", type: "filter", icon: "Filter", color: "muted", positionX: 600, positionY: 150, active: true },
      { label: "Sentiment Check", type: "filter", icon: "Database", color: "muted", positionX: 600, positionY: 280, active: true },
      { 
        label: "Institutional Research Ghostwriter", 
        type: "llm_agent", 
        icon: "Brain", 
        color: "secondary", 
        positionX: 850, 
        positionY: 200, 
        active: true, 
        config: { 
          nodeType: "ghostwriter",
          inputs: {
            rawEventJson: true,
            tickerContext: {
              float: true,
              shortInterest: true,
              catalysts: true,
              analystTargets: true,
              insiderActivity: true
            }
          },
          threadStructure: {
            tweet1_hook: "Print/sweep size, avg price, venue(s), % of ADV, directional tone",
            tweet2_context: "Share float, short interest %, recent catalysts, analyst PT vs spot, insider activity",
            tweet3_technicals: "Key support/resistance, volume profile POC, order flow implications, EMA stack position",
            tweet4_scenarios: "2-3 probability-weighted outcomes + overall conviction (High/Medium/Low)"
          },
          toneRules: {
            voice: "ice-cold institutional",
            styleGuide: ["Jane Street", "Citadel research desk"],
            forbidden: ["retail hype", "emojis in main body", "speculation without data"],
            preferredPhrases: [
              "notable accumulation",
              "aggressive distribution", 
              "likely counterparty covering",
              "delta-positive flow",
              "vanna/charm pressure building",
              "gamma exposure suggests",
              "positioning implies",
              "risk/reward skewed"
            ]
          },
          variants: {
            neutral: { bias: 0, description: "Data-only interpretation" },
            bullish: { bias: 1, description: "Bullish-leaning interpretation" },
            bearish: { bias: -1, description: "Bearish-leaning interpretation" }
          },
          autoSelect: {
            enabled: true,
            criteria: ["print_delta", "price_reaction", "flow_direction"],
            thresholds: {
              bullishDelta: 0.3,
              bearishDelta: -0.3
            }
          },
          maxCharsPerTweet: 280
        }
      },
      {
        label: "Auto Chart & Flow Engine",
        type: "llm_agent",
        icon: "BarChart3",
        color: "warning",
        positionX: 850,
        positionY: 350,
        active: true,
        config: {
          nodeType: "chart_engine",
          outputs: {
            image1_chart: {
              name: "TradingView-style Chart",
              description: "Annotated price chart with dark pool print markers",
              attachTo: "tweet1"
            },
            image2_flowCard: {
              name: "Flow Summary Card",
              description: "Branded Dark Pool Data summary card",
              attachTo: "tweet2_or_3"
            }
          },
          chartConfig: {
            theme: "dark",
            timeframe: "1h",
            timeframeOptions: ["15m", "1h", "4h", "1D"],
            elements: {
              candles: true,
              darkPoolPrintMarker: true,
              volumeProfile: {
                enabled: true,
                showPOC: true,
                showVAH: true,
                showVAL: true
              },
              emas: {
                enabled: true,
                periods: [20, 50, 200]
              },
              vwap: {
                enabled: true,
                sessionVWAP: true,
                previousClose: true
              },
              keyLevels: {
                enabled: true,
                recentHighLow: true,
                gapFills: true
              }
            },
            maxElements: 6,
            style: {
              backgroundColor: "#0a0a0f",
              gridColor: "#1a1a2e",
              upColor: "#10B981",
              downColor: "#EF4444",
              textColor: "#e0e0e0"
            }
          },
          flowCardConfig: {
            layout: "branded",
            theme: "dark",
            elements: {
              ticker: { size: "large", position: "top-left" },
              timestamp: { format: "MMM DD, HH:mm", position: "top-right" },
              printSize: { showUSD: true, showShares: true, showContracts: true },
              greeks: { delta: true, gamma: true, premium: true },
              breakeven: { showIfOptions: true },
              conviction: { badge: true, arrow: true }
            },
            colors: {
              background: "#0a0a0f",
              border: "#1a1a2e",
              buyAccent: "#10B981",
              sellAccent: "#EF4444",
              neutralAccent: "#6366F1"
            },
            branding: {
              logo: "Dark Pool Data",
              watermark: true
            }
          }
        }
      },
      { label: "Post to X", type: "action", icon: "Twitter", color: "primary", positionX: 1100, positionY: 150, active: true },
      { label: "Send Alert", type: "action", icon: "Bell", color: "negative", positionX: 1100, positionY: 280, active: false },
      {
        label: "Global Error Handler",
        type: "utility",
        icon: "ShieldAlert",
        color: "negative",
        positionX: 100,
        positionY: 400,
        active: true,
        config: {
          nodeType: "error_handler",
          monitoredApis: ["unusual_whales", "twitter", "polygon", "alpha_vantage", "fmp", "sec_edgar"],
          retryPolicy: { maxRetries: 3, backoffMs: 5000 },
          errorTypes: ["rate_limit", "auth_failure", "network_error", "timeout"],
          notifyOnError: true,
          logLevel: "error"
        }
      },
      {
        label: "Fallback Logic",
        type: "utility",
        icon: "GitBranch",
        color: "warning",
        positionX: 350,
        positionY: 400,
        active: true,
        config: {
          nodeType: "fallback",
          fallbacks: {
            unusual_whales: { primary: "unusual_whales", fallback: ["polygon", "alpha_vantage"], mode: "price_volume_only" },
            image_gen: { onFail: "text_only_thread", notify: true }
          },
          textOnlyMode: { enabled: true, trigger: "image_gen_failure" }
        }
      }
    ];

    workflowNodes.forEach((node, index) => {
      const id = (index + 1).toString();
      this.workflowNodes.set(id, { id, ...node });
    });

    const healthComponents = ["scanner", "llm_agent", "chart_gen", "poster"];
    healthComponents.forEach((component) => {
      const id = randomUUID();
      this.healthSnapshots.set(component, {
        id,
        component,
        status: "green",
        lastCheck: new Date().toISOString(),
        message: "All systems operational",
        metrics: { uptime: 99.9, latency: 120, errors24h: 0 }
      });
    });

    const defaultAlerts: InsertAlertRule[] = [
      { name: "High-Conviction Missed", alertType: "missed_post", enabled: true, threshold: 0.8, channelIds: null, config: { conviction: "high" } },
      { name: "Follower Drop", alertType: "follower_drop", enabled: true, threshold: 5, channelIds: null, config: { period: "24h" } },
      { name: "Low Engagement", alertType: "engagement_velocity", enabled: true, threshold: 2.5, channelIds: null, config: { metric: "engagement_rate" } },
      { name: "API Key Expiring", alertType: "api_key_expiry", enabled: true, threshold: 7, channelIds: null, config: { daysWarning: 7 } }
    ];

    defaultAlerts.forEach((alert) => {
      const id = randomUUID();
      this.alertRules.set(id, { id, ...alert });
    });

    const sampleLogs: InsertSystemLog[] = [
      { timestamp: new Date().toISOString(), component: "scanner", eventType: "scan_complete", status: "success", message: "Scanned 45 dark pool prints", metadata: { duration: 2340 } },
      { timestamp: new Date(Date.now() - 300000).toISOString(), component: "poster", eventType: "post_published", status: "success", message: "Thread posted to X", metadata: { postId: "12345" } },
      { timestamp: new Date(Date.now() - 600000).toISOString(), component: "llm_agent", eventType: "thread_generated", status: "success", message: "Generated NVDA thread", metadata: { ticker: "NVDA" } },
      { timestamp: new Date(Date.now() - 900000).toISOString(), component: "chart_gen", eventType: "image_generated", status: "success", message: "Chart and flow card ready", metadata: {} },
      { timestamp: new Date(Date.now() - 1200000).toISOString(), component: "scanner", eventType: "api_call", status: "warning", message: "Rate limit approaching", metadata: { remaining: 50 } }
    ];

    sampleLogs.forEach((log) => {
      const id = randomUUID();
      this.systemLogs.set(id, { id, ...log });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAutomationSettings(): Promise<AutomationSettings | undefined> {
    return this.automationSettings;
  }

  async updateAutomationSettings(settings: Partial<InsertAutomationSettings>): Promise<AutomationSettings> {
    if (!this.automationSettings) {
      this.automationSettings = {
        id: randomUUID(),
        masterEnabled: false,
        darkPoolScanner: false,
        unusualOptionsSweeps: false,
        autoThreadPosting: false,
        analyticsTracking: true,
      };
    }
    this.automationSettings = { ...this.automationSettings, ...settings };
    return this.automationSettings;
  }

  async getPosts(): Promise<Post[]> {
    return Array.from(this.posts.values());
  }

  async getPost(id: string): Promise<Post | undefined> {
    return this.posts.get(id);
  }

  async createPost(post: InsertPost): Promise<Post> {
    const id = randomUUID();
    const newPost: Post = { 
      id, 
      content: post.content,
      variant: post.variant || "A",
      status: post.status || "draft",
      scheduledAt: post.scheduledAt || null,
      postedAt: post.postedAt || null,
      impressions: post.impressions || 0,
      engagements: post.engagements || 0,
      clicks: post.clicks || 0,
      retweets: post.retweets || 0,
      likes: post.likes || 0,
      replies: post.replies || 0,
      tags: post.tags || null,
    };
    this.posts.set(id, newPost);
    return newPost;
  }

  async updatePost(id: string, post: Partial<InsertPost>): Promise<Post | undefined> {
    const existing = this.posts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...post };
    this.posts.set(id, updated);
    return updated;
  }

  async deletePost(id: string): Promise<boolean> {
    return this.posts.delete(id);
  }

  async getDarkPoolData(): Promise<DarkPoolData[]> {
    return Array.from(this.darkPoolData.values());
  }

  async createDarkPoolData(data: InsertDarkPoolData): Promise<DarkPoolData> {
    const id = randomUUID();
    const newData: DarkPoolData = { id, ...data };
    this.darkPoolData.set(id, newData);
    return newData;
  }

  async getUnusualOptions(): Promise<UnusualOptions[]> {
    return Array.from(this.unusualOptions.values());
  }

  async createUnusualOptions(data: InsertUnusualOptions): Promise<UnusualOptions> {
    const id = randomUUID();
    const newData: UnusualOptions = { id, ...data };
    this.unusualOptions.set(id, newData);
    return newData;
  }

  async getWorkflowNodes(): Promise<WorkflowNode[]> {
    return Array.from(this.workflowNodes.values());
  }

  async createWorkflowNode(node: InsertWorkflowNode): Promise<WorkflowNode> {
    const id = randomUUID();
    const newNode: WorkflowNode = { id, ...node };
    this.workflowNodes.set(id, newNode);
    return newNode;
  }

  async updateWorkflowNode(id: string, node: Partial<InsertWorkflowNode>): Promise<WorkflowNode | undefined> {
    const existing = this.workflowNodes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...node };
    this.workflowNodes.set(id, updated);
    return updated;
  }

  async deleteWorkflowNode(id: string): Promise<boolean> {
    return this.workflowNodes.delete(id);
  }

  async getWorkflowConnections(): Promise<WorkflowConnection[]> {
    return Array.from(this.workflowConnections.values());
  }

  async createWorkflowConnection(connection: InsertWorkflowConnection): Promise<WorkflowConnection> {
    const id = randomUUID();
    const newConnection: WorkflowConnection = { id, ...connection };
    this.workflowConnections.set(id, newConnection);
    return newConnection;
  }

  async deleteWorkflowConnection(id: string): Promise<boolean> {
    return this.workflowConnections.delete(id);
  }

  async getApiConnectors(): Promise<ApiConnector[]> {
    return Array.from(this.apiConnectors.values());
  }

  async getApiConnector(id: string): Promise<ApiConnector | undefined> {
    return this.apiConnectors.get(id);
  }

  async getApiConnectorByProvider(provider: string): Promise<ApiConnector | undefined> {
    return Array.from(this.apiConnectors.values()).find(c => c.provider === provider);
  }

  async createApiConnector(connector: InsertApiConnector): Promise<ApiConnector> {
    const id = randomUUID();
    const newConnector: ApiConnector = { id, ...connector, lastError: null, rateLimitRemaining: null, rateLimitReset: null };
    this.apiConnectors.set(id, newConnector);
    return newConnector;
  }

  async updateApiConnector(id: string, connector: Partial<InsertApiConnector>): Promise<ApiConnector | undefined> {
    const existing = this.apiConnectors.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...connector };
    this.apiConnectors.set(id, updated);
    return updated;
  }

  async getAnalyticsData(period?: string): Promise<AnalyticsData[]> {
    const data = Array.from(this.analyticsData.values());
    if (period) {
      return data.filter(d => d.period === period);
    }
    return data;
  }

  async createAnalyticsData(data: InsertAnalyticsData): Promise<AnalyticsData> {
    const id = randomUUID();
    const newData: AnalyticsData = { id, ...data };
    this.analyticsData.set(id, newData);
    return newData;
  }

  async getScannerConfig(): Promise<ScannerConfig | undefined> {
    return this.scannerConfig;
  }

  async updateScannerConfig(config: Partial<InsertScannerConfig>): Promise<ScannerConfig> {
    if (!this.scannerConfig) {
      this.scannerConfig = {
        id: randomUUID(),
        name: "Master Scanner",
        enabled: true,
        refreshIntervalMs: 300000,
        darkPoolMinNotional: 2000000,
        darkPoolMinAdvPercent: 5,
        optionsMinPremium: 1000000,
        optionsMinOiChangePercent: 500,
        optionsSweepMinSize: 500000,
        includeBlockTrades: true,
        includeVenueImbalance: true,
        includeInsiderFilings: true,
        includeCatalystEvents: true,
        lastRun: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    this.scannerConfig = { ...this.scannerConfig, ...config, updatedAt: new Date().toISOString() };
    return this.scannerConfig;
  }

  async getMarketEvents(filters?: { eventType?: string; ticker?: string; limit?: number }): Promise<MarketEvent[]> {
    let events = Array.from(this.marketEvents.values());
    
    if (filters?.eventType) {
      events = events.filter(e => e.eventType === filters.eventType);
    }
    if (filters?.ticker) {
      events = events.filter(e => e.ticker === filters.ticker);
    }
    
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }
    
    return events;
  }

  async createMarketEvent(event: InsertMarketEvent): Promise<MarketEvent> {
    const id = randomUUID();
    const newEvent: MarketEvent = { id, ...event };
    this.marketEvents.set(id, newEvent);
    return newEvent;
  }

  async clearMarketEvents(): Promise<void> {
    this.marketEvents.clear();
  }

  async getSystemLogs(limit: number = 100): Promise<SystemLog[]> {
    const logs = Array.from(this.systemLogs.values());
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs.slice(0, limit);
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const id = randomUUID();
    const newLog: SystemLog = { id, ...log };
    this.systemLogs.set(id, newLog);
    if (this.systemLogs.size > 500) {
      const logs = Array.from(this.systemLogs.entries())
        .sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime());
      this.systemLogs = new Map(logs.slice(0, 500));
    }
    return newLog;
  }

  async getNotificationChannels(): Promise<NotificationChannel[]> {
    return Array.from(this.notificationChannels.values());
  }

  async createNotificationChannel(channel: InsertNotificationChannel): Promise<NotificationChannel> {
    const id = randomUUID();
    const newChannel: NotificationChannel = { id, ...channel };
    this.notificationChannels.set(id, newChannel);
    return newChannel;
  }

  async updateNotificationChannel(id: string, channel: Partial<InsertNotificationChannel>): Promise<NotificationChannel | undefined> {
    const existing = this.notificationChannels.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...channel };
    this.notificationChannels.set(id, updated);
    return updated;
  }

  async deleteNotificationChannel(id: string): Promise<boolean> {
    return this.notificationChannels.delete(id);
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return Array.from(this.alertRules.values());
  }

  async createAlertRule(rule: InsertAlertRule): Promise<AlertRule> {
    const id = randomUUID();
    const newRule: AlertRule = { id, ...rule };
    this.alertRules.set(id, newRule);
    return newRule;
  }

  async updateAlertRule(id: string, rule: Partial<InsertAlertRule>): Promise<AlertRule | undefined> {
    const existing = this.alertRules.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...rule };
    this.alertRules.set(id, updated);
    return updated;
  }

  async getHealthSnapshots(): Promise<HealthSnapshot[]> {
    return Array.from(this.healthSnapshots.values());
  }

  async updateHealthSnapshot(component: string, snapshot: Partial<InsertHealthSnapshot>): Promise<HealthSnapshot> {
    const existing = this.healthSnapshots.get(component);
    if (existing) {
      const updated = { ...existing, ...snapshot, lastCheck: new Date().toISOString() };
      this.healthSnapshots.set(component, updated);
      return updated;
    }
    const id = randomUUID();
    const newSnapshot: HealthSnapshot = {
      id,
      component,
      status: snapshot.status || "green",
      lastCheck: new Date().toISOString(),
      message: snapshot.message || null,
      metrics: snapshot.metrics || null
    };
    this.healthSnapshots.set(component, newSnapshot);
    return newSnapshot;
  }

  async getTestPosts(limit: number = 50): Promise<TestPost[]> {
    const posts = Array.from(this.testPosts.values());
    posts.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    return posts.slice(0, limit);
  }

  async createTestPost(post: InsertTestPost): Promise<TestPost> {
    const id = randomUUID();
    const newPost: TestPost = { id, ...post };
    this.testPosts.set(id, newPost);
    return newPost;
  }

  async clearTestPosts(): Promise<void> {
    this.testPosts.clear();
  }

  async getTestModeSettings(): Promise<TestModeSettings | undefined> {
    return this.testModeSettings;
  }

  async updateTestModeSettings(settings: Partial<InsertTestModeSettings>): Promise<TestModeSettings> {
    if (!this.testModeSettings) {
      this.testModeSettings = {
        id: randomUUID(),
        enabled: settings.enabled ?? false,
        intervalMinutes: settings.intervalMinutes ?? 30,
        lastGenerated: settings.lastGenerated ?? null,
        autoGenerate: settings.autoGenerate ?? false,
        stocksOnly: settings.stocksOnly ?? false,
      };
    } else {
      this.testModeSettings = { ...this.testModeSettings, ...settings };
    }
    return this.testModeSettings;
  }
}

export const storage = new MemStorage();
