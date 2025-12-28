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
      { label: "Post to X", type: "action", icon: "Twitter", color: "primary", positionX: 1100, positionY: 150, active: true },
      { label: "Send Alert", type: "action", icon: "Bell", color: "negative", positionX: 1100, positionY: 280, active: false },
    ];

    workflowNodes.forEach((node, index) => {
      const id = (index + 1).toString();
      this.workflowNodes.set(id, { id, ...node });
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
}

export const storage = new MemStorage();
