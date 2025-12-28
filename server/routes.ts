import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertPostSchema, 
  insertDarkPoolDataSchema, 
  insertUnusualOptionsSchema, 
  insertApiConnectorSchema, 
  insertWorkflowNodeSchema, 
  insertWorkflowConnectionSchema, 
  insertAnalyticsDataSchema,
  insertScannerConfigSchema,
  insertMarketEventSchema,
  insertSystemLogSchema,
  insertNotificationChannelSchema,
  insertAlertRuleSchema,
  insertHealthSnapshotSchema
} from "@shared/schema";
import { z } from "zod";
import { 
  fetchUnusualWhalesData, 
  getEnrichedTickerData,
  generateMockDarkPoolPrint,
  generateMockOptionsSweep 
} from "./live-data-service";
import { 
  generateChartSvg, 
  generateFlowSummarySvg,
  generateMockCandles,
  generateVolatilitySmileSvg,
  generateOptionsFlowHeatmapSvg,
  generatePutCallOILadderSvg,
  generateIVTermStructureSvg,
  generateMockVolatilitySmileData,
  generateMockOptionsFlowData,
  generateMockPutCallOIData,
  generateMockIVTermStructureData,
  createSessionContext,
  generateSessionCandles,
  formatSessionTimestamp
} from "./chart-generator";

const scannerConfigUpdateSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  refreshIntervalMs: z.number().int().min(60000).max(3600000).optional(),
  darkPoolMinNotional: z.number().min(0).optional(),
  darkPoolMinAdvPercent: z.number().min(0).max(100).optional(),
  optionsMinPremium: z.number().min(0).optional(),
  optionsMinOiChangePercent: z.number().min(0).optional(),
  optionsSweepMinSize: z.number().min(0).optional(),
  includeBlockTrades: z.boolean().optional(),
  includeVenueImbalance: z.boolean().optional(),
  includeInsiderFilings: z.boolean().optional(),
  includeCatalystEvents: z.boolean().optional(),
  lastRun: z.string().nullable().optional(),
}).strict();

async function testProviderConnection(provider: string): Promise<{ success: boolean; message: string }> {
  try {
    switch (provider) {
      case "unusual_whales": {
        const apiKey = process.env.UNUSUAL_WHALES_API_KEY;
        if (!apiKey) {
          return { success: false, message: "Missing UNUSUAL_WHALES_API_KEY" };
        }
        const response = await fetch("https://api.unusualwhales.com/api/market/overview", {
          headers: { 
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json"
          }
        });
        if (response.status === 401 || response.status === 403) {
          return { success: false, message: "Invalid API key or insufficient permissions" };
        }
        if (!response.ok) {
          const altResponse = await fetch("https://api.unusualwhales.com/api/darkpool/recent?limit=1", {
            headers: { 
              "Authorization": `Bearer ${apiKey}`,
              "Accept": "application/json"
            }
          });
          if (altResponse.status === 401 || altResponse.status === 403) {
            return { success: false, message: "Invalid API key or insufficient permissions" };
          }
          if (!altResponse.ok) {
            return { success: false, message: `API error: ${altResponse.status}` };
          }
        }
        return { success: true, message: "Unusual Whales connected successfully" };
      }

      case "twitter": {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return { success: false, message: "Missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET" };
        }
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenResponse = await fetch("https://api.twitter.com/oauth2/token", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: "grant_type=client_credentials"
        });
        if (!tokenResponse.ok) {
          if (tokenResponse.status === 403) {
            return { success: false, message: "Twitter app needs 'Elevated' access. Go to Twitter Developer Portal > Products > Twitter API v2 > Elevated" };
          }
          return { success: false, message: `Twitter auth failed: ${tokenResponse.status} - Verify Client ID and Secret are correct` };
        }
        const tokenData = await tokenResponse.json() as { access_token?: string; token_type?: string };
        if (!tokenData.access_token) {
          return { success: false, message: "Twitter did not return access token" };
        }
        return { success: true, message: "Twitter/X connected successfully (App-only auth)" };
      }

      case "polygon": {
        const apiKey = process.env.POLYGON_API_KEY;
        if (!apiKey) {
          return { success: false, message: "Missing POLYGON_API_KEY" };
        }
        const response = await fetch(`https://api.polygon.io/v3/reference/tickers?active=true&limit=1&apiKey=${apiKey}`);
        if (response.status === 401 || response.status === 403) {
          return { success: false, message: "Invalid API key" };
        }
        if (!response.ok) {
          return { success: false, message: `API error: ${response.status}` };
        }
        return { success: true, message: "Polygon.io connected successfully" };
      }

      case "alpha_vantage": {
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
          return { success: false, message: "Missing ALPHA_VANTAGE_API_KEY" };
        }
        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=${apiKey}`);
        if (!response.ok) {
          return { success: false, message: `API error: ${response.status}` };
        }
        const data = await response.json();
        if (data.Note && data.Note.includes("API call frequency")) {
          return { success: true, message: "Alpha Vantage connected (rate limited)" };
        }
        if (data["Error Message"]) {
          return { success: false, message: "Invalid API key" };
        }
        return { success: true, message: "Alpha Vantage connected successfully" };
      }

      case "fmp": {
        const apiKey = process.env.FMP_API_KEY;
        if (!apiKey) {
          return { success: false, message: "Missing FMP_API_KEY" };
        }
        const response = await fetch(`https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${apiKey}`);
        if (response.status === 401 || response.status === 403) {
          return { success: false, message: "Invalid API key" };
        }
        if (!response.ok) {
          return { success: false, message: `API error: ${response.status}` };
        }
        return { success: true, message: "FMP connected successfully" };
      }

      case "sec_edgar": {
        const userAgent = process.env.SEC_EDGAR_USER_AGENT;
        if (!userAgent) {
          return { success: false, message: "Missing SEC_EDGAR_USER_AGENT" };
        }
        const response = await fetch("https://data.sec.gov/submissions/CIK0000320193.json", {
          headers: { "User-Agent": userAgent }
        });
        if (response.status === 403) {
          return { success: false, message: "Invalid User-Agent format (use: email@domain.com)" };
        }
        if (!response.ok) {
          return { success: false, message: `API error: ${response.status}` };
        }
        return { success: true, message: "SEC EDGAR connected successfully" };
      }

      default:
        return { success: false, message: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Automation Settings
  app.get("/api/settings/automation", async (req, res) => {
    try {
      const settings = await storage.getAutomationSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get automation settings" });
    }
  });

  app.patch("/api/settings/automation", async (req, res) => {
    try {
      const settings = await storage.updateAutomationSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update automation settings" });
    }
  });

  // Scanner Configuration
  app.get("/api/scanner/config", async (req, res) => {
    try {
      const config = await storage.getScannerConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get scanner config" });
    }
  });

  app.patch("/api/scanner/config", async (req, res) => {
    try {
      const result = scannerConfigUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      
      const config = await storage.updateScannerConfig(result.data);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to update scanner config" });
    }
  });

  // Market Events
  app.get("/api/scanner/events", async (req, res) => {
    try {
      const { eventType, ticker, limit } = req.query;
      const events = await storage.getMarketEvents({
        eventType: eventType as string | undefined,
        ticker: ticker as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to get market events" });
    }
  });

  app.post("/api/scanner/events", async (req, res) => {
    try {
      const result = insertMarketEventSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const event = await storage.createMarketEvent(result.data);
      res.status(201).json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to create market event" });
    }
  });

  // Manual Scanner Trigger
  app.post("/api/scanner/run", async (req, res) => {
    try {
      const config = await storage.getScannerConfig();
      if (!config?.enabled) {
        return res.status(400).json({ error: "Scanner is disabled" });
      }
      
      const connectors = await storage.getApiConnectors();
      const connectedProviders = connectors.filter(c => c.status === "connected").map(c => c.provider);
      
      if (connectedProviders.length === 0) {
        return res.status(400).json({ error: "No data providers connected. Please configure API keys." });
      }

      await storage.updateScannerConfig({ lastRun: new Date().toISOString() });

      res.json({ 
        success: true, 
        message: "Scanner run initiated",
        connectedProviders,
        filters: {
          darkPoolMinNotional: config.darkPoolMinNotional,
          darkPoolMinAdvPercent: config.darkPoolMinAdvPercent,
          optionsMinPremium: config.optionsMinPremium,
          optionsMinOiChangePercent: config.optionsMinOiChangePercent,
          optionsSweepMinSize: config.optionsSweepMinSize,
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to run scanner" });
    }
  });

  // Connector Test/Validate
  app.post("/api/connectors/:id/test", async (req, res) => {
    try {
      const connector = await storage.getApiConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: "Connector not found" });
      }

      const provider = connector.provider;
      const testResult = await testProviderConnection(provider || "");
      
      await storage.updateApiConnector(req.params.id, { 
        status: testResult.success ? "connected" : "disconnected",
        lastSync: testResult.success ? new Date().toISOString() : connector.lastSync,
        lastError: testResult.success ? null : testResult.message
      });

      res.json({ 
        success: testResult.success, 
        message: testResult.message,
        status: testResult.success ? "connected" : "disconnected"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to test connector" });
    }
  });

  // Get required API keys status
  app.get("/api/connectors/keys/status", async (req, res) => {
    try {
      const connectors = await storage.getApiConnectors();
      const keyStatus = connectors.map(c => {
        const envVar = getApiKeyEnvVar(c.provider || "");
        const isTwitter = c.provider === "twitter";
        return {
          provider: c.provider,
          name: c.name,
          envVar: isTwitter ? "TWITTER_CLIENT_ID & TWITTER_CLIENT_SECRET" : envVar,
          configured: isTwitter 
            ? !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET)
            : !!process.env[envVar],
          status: c.status
        };
      });
      res.json(keyStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to get key status" });
    }
  });

  // Posts
  app.get("/api/posts", async (req, res) => {
    try {
      const posts = await storage.getPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get posts" });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ error: "Failed to get post" });
    }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const result = insertPostSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const post = await storage.createPost(result.data);
      res.status(201).json(post);
    } catch (error) {
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.patch("/api/posts/:id", async (req, res) => {
    try {
      const post = await storage.updatePost(req.params.id, req.body);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ error: "Failed to update post" });
    }
  });

  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  // Dark Pool Data
  app.get("/api/dark-pool", async (req, res) => {
    try {
      const data = await storage.getDarkPoolData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get dark pool data" });
    }
  });

  app.post("/api/dark-pool", async (req, res) => {
    try {
      const result = insertDarkPoolDataSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const data = await storage.createDarkPoolData(result.data);
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to create dark pool data" });
    }
  });

  // Unusual Options
  app.get("/api/unusual-options", async (req, res) => {
    try {
      const data = await storage.getUnusualOptions();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get unusual options" });
    }
  });

  app.post("/api/unusual-options", async (req, res) => {
    try {
      const result = insertUnusualOptionsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const data = await storage.createUnusualOptions(result.data);
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to create unusual options" });
    }
  });

  // API Connectors
  app.get("/api/connectors", async (req, res) => {
    try {
      const connectors = await storage.getApiConnectors();
      res.json(connectors);
    } catch (error) {
      res.status(500).json({ error: "Failed to get connectors" });
    }
  });

  app.get("/api/connectors/:id", async (req, res) => {
    try {
      const connector = await storage.getApiConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: "Connector not found" });
      }
      res.json(connector);
    } catch (error) {
      res.status(500).json({ error: "Failed to get connector" });
    }
  });

  app.post("/api/connectors", async (req, res) => {
    try {
      const result = insertApiConnectorSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const connector = await storage.createApiConnector(result.data);
      res.status(201).json(connector);
    } catch (error) {
      res.status(500).json({ error: "Failed to create connector" });
    }
  });

  app.patch("/api/connectors/:id", async (req, res) => {
    try {
      const connector = await storage.updateApiConnector(req.params.id, req.body);
      if (!connector) {
        return res.status(404).json({ error: "Connector not found" });
      }
      res.json(connector);
    } catch (error) {
      res.status(500).json({ error: "Failed to update connector" });
    }
  });

  // Workflow Nodes
  app.get("/api/workflow/nodes", async (req, res) => {
    try {
      const nodes = await storage.getWorkflowNodes();
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get workflow nodes" });
    }
  });

  app.post("/api/workflow/nodes", async (req, res) => {
    try {
      const result = insertWorkflowNodeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const node = await storage.createWorkflowNode(result.data);
      res.status(201).json(node);
    } catch (error) {
      res.status(500).json({ error: "Failed to create workflow node" });
    }
  });

  app.patch("/api/workflow/nodes/:id", async (req, res) => {
    try {
      const node = await storage.updateWorkflowNode(req.params.id, req.body);
      if (!node) {
        return res.status(404).json({ error: "Node not found" });
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: "Failed to update workflow node" });
    }
  });

  app.delete("/api/workflow/nodes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWorkflowNode(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Node not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow node" });
    }
  });

  // Workflow Connections
  app.get("/api/workflow/connections", async (req, res) => {
    try {
      const connections = await storage.getWorkflowConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to get workflow connections" });
    }
  });

  app.post("/api/workflow/connections", async (req, res) => {
    try {
      const result = insertWorkflowConnectionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const connection = await storage.createWorkflowConnection(result.data);
      res.status(201).json(connection);
    } catch (error) {
      res.status(500).json({ error: "Failed to create workflow connection" });
    }
  });

  app.delete("/api/workflow/connections/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWorkflowConnection(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow connection" });
    }
  });

  // Analytics
  app.get("/api/analytics", async (req, res) => {
    try {
      const period = req.query.period as string | undefined;
      const data = await storage.getAnalyticsData(period);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get analytics data" });
    }
  });

  app.post("/api/analytics", async (req, res) => {
    try {
      const result = insertAnalyticsDataSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const data = await storage.createAnalyticsData(result.data);
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to create analytics data" });
    }
  });

  // System Logs
  app.get("/api/logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getSystemLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get system logs" });
    }
  });

  app.post("/api/logs", async (req, res) => {
    try {
      const result = insertSystemLogSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const log = await storage.createSystemLog(result.data);
      res.status(201).json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to create system log" });
    }
  });

  // Notification Channels
  app.get("/api/notifications/channels", async (req, res) => {
    try {
      const channels = await storage.getNotificationChannels();
      res.json(channels);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notification channels" });
    }
  });

  app.post("/api/notifications/channels", async (req, res) => {
    try {
      const result = insertNotificationChannelSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const channel = await storage.createNotificationChannel(result.data);
      res.status(201).json(channel);
    } catch (error) {
      res.status(500).json({ error: "Failed to create notification channel" });
    }
  });

  app.patch("/api/notifications/channels/:id", async (req, res) => {
    try {
      const channel = await storage.updateNotificationChannel(req.params.id, req.body);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification channel" });
    }
  });

  app.delete("/api/notifications/channels/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteNotificationChannel(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification channel" });
    }
  });

  // Alert Rules
  app.get("/api/notifications/alerts", async (req, res) => {
    try {
      const rules = await storage.getAlertRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alert rules" });
    }
  });

  app.post("/api/notifications/alerts", async (req, res) => {
    try {
      const result = insertAlertRuleSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const rule = await storage.createAlertRule(result.data);
      res.status(201).json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to create alert rule" });
    }
  });

  app.patch("/api/notifications/alerts/:id", async (req, res) => {
    try {
      const rule = await storage.updateAlertRule(req.params.id, req.body);
      if (!rule) {
        return res.status(404).json({ error: "Alert rule not found" });
      }
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert rule" });
    }
  });

  // Health Snapshots
  app.get("/api/health", async (req, res) => {
    try {
      const snapshots = await storage.getHealthSnapshots();
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to get health snapshots" });
    }
  });

  app.post("/api/health/:component", async (req, res) => {
    try {
      const snapshot = await storage.updateHealthSnapshot(req.params.component, req.body);
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ error: "Failed to update health snapshot" });
    }
  });

  // Test Mode Routes
  app.get("/api/test-mode/settings", async (req, res) => {
    try {
      let settings = await storage.getTestModeSettings();
      if (!settings) {
        settings = await storage.updateTestModeSettings({
          enabled: false,
          intervalMinutes: 30,
          autoGenerate: false
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get test mode settings" });
    }
  });

  app.patch("/api/test-mode/settings", async (req, res) => {
    try {
      const settings = await storage.updateTestModeSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update test mode settings" });
    }
  });

  app.get("/api/test-mode/posts", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const posts = await storage.getTestPosts(limit);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get test posts" });
    }
  });

  app.post("/api/test-mode/generate", async (req, res) => {
    try {
      let dataItem: { type: string; data: any; isLive: boolean };
      let isLiveData = false;

      // Try to fetch live data from Unusual Whales first
      const liveData = await fetchUnusualWhalesData();
      
      if (liveData.darkPool.length > 0 || liveData.options.length > 0) {
        isLiveData = true;
        const allLive = [
          ...liveData.darkPool.map(d => ({ type: 'dark_pool', data: d })),
          ...liveData.options.map(o => ({ type: 'options', data: o }))
        ];
        const selected = allLive[Math.floor(Math.random() * allLive.length)];
        dataItem = { ...selected, isLive: true };
      } else {
        // Fall back to mock data generation
        const useDarkPool = Math.random() > 0.5;
        if (useDarkPool) {
          dataItem = { type: 'dark_pool', data: generateMockDarkPoolPrint(), isLive: false };
        } else {
          dataItem = { type: 'options', data: generateMockOptionsSweep(), isLive: false };
        }
      }
      
      const post = await generateTestPost(dataItem, isLiveData);
      const created = await storage.createTestPost(post);
      
      await storage.updateTestModeSettings({ lastGenerated: new Date().toISOString() });
      
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to generate test post:", error);
      res.status(500).json({ error: "Failed to generate test post" });
    }
  });

  app.delete("/api/test-mode/posts", async (req, res) => {
    try {
      await storage.clearTestPosts();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear test posts" });
    }
  });

  return httpServer;
}

async function generateTestPost(item: { type: string; data: any }, isLiveData: boolean = false): Promise<any> {
  const isOptions = item.type === 'options';
  const data = item.data;
  
  // Create synchronized session context for all charts and content
  const session = createSessionContext();
  const asOfTimestamp = formatSessionTimestamp(session.asOfTime, 'short');
  
  const ticker = data.ticker;
  const sentiment = isOptions 
    ? (data.type === 'CALL' ? 'bullish' : 'bearish')
    : (data.sentiment?.toLowerCase() || 'neutral');
  
  const convictions = ['high', 'medium', 'low'];
  const conviction = convictions[Math.floor(Math.random() * convictions.length)];
  
  const variants = ['neutral', 'bullish', 'bearish'];
  const variant = sentiment === 'bullish' ? 'bullish' : sentiment === 'bearish' ? 'bearish' : variants[Math.floor(Math.random() * variants.length)];
  
  // Generate institutional-grade market context
  const advPercent = (5 + Math.random() * 15).toFixed(1);
  const vwapDelta = (sentiment === 'bullish' ? '+' : '-') + (0.1 + Math.random() * 0.5).toFixed(2);
  const dealerGamma = sentiment === 'bullish' ? 'long gamma' : 'short gamma';
  const ivPercentile = Math.floor(70 + Math.random() * 25);
  const skewDirection = sentiment === 'bullish' ? 'call' : 'put';
  const historicalComparison = ['Q4 2023 rally', 'Nov 2024 breakout', 'Sep 2024 correction'][Math.floor(Math.random() * 3)];
  
  let thread: any[];
  
  if (isOptions) {
    const premium = data.premium || '$1.2M';
    const strike = data.strike || 150;
    const expiry = data.expiry || 'Jan 17';
    const optionType = data.type || 'CALL';
    const volume = data.volume?.toLocaleString() || '8,500';
    const oi = data.openInterest?.toLocaleString() || '25,000';
    const deltaExposure = (Math.random() * 50 + 20).toFixed(0);
    
    thread = [
      {
        index: 1,
        content: `1/5 ALERT [${asOfTimestamp} ET]: Anomalous ${optionType} sweep detected via @unusual_whales. $${ticker} ${strike}${optionType[0]} ${expiry} - ${premium} notional. Vol ${volume} vs OI ${oi} (${(parseInt(volume.replace(/,/g, '')) / parseInt(oi.replace(/,/g, '')) * 100).toFixed(0)}% ratio). Print at NBBO mid.`,
        type: 'hook'
      },
      {
        index: 2,
        content: `2/5 Flow Context: Net delta exposure +${deltaExposure}K shares equiv. P/C OI ratio at 0.${Math.floor(60 + Math.random() * 40)} (${ivPercentile}th %ile). 25-delta RR: ${skewDirection}-side premium. Dealer positioning: ${dealerGamma}. Similar pattern last seen ${historicalComparison}.`,
        type: 'context'
      },
      {
        index: 3,
        content: `3/5 Structure: Strike cluster ${strike-5}/${strike}/${strike+5} showing ${(1 + Math.random() * 2).toFixed(1)}x normal activity. GEX flip level: $${(strike * 0.97).toFixed(0)}. Max pain: $${strike}. Vanna/charm ${optionType === 'CALL' ? 'tailwind' : 'headwind'} into ${expiry} expiry.`,
        type: 'technicals'
      },
      {
        index: 4,
        content: `4/5 Volatility: IV ${ivPercentile}th %ile. ATM IV ${(25 + Math.random() * 15).toFixed(1)}% vs 20d realized ${(20 + Math.random() * 10).toFixed(1)}%. Term structure ${Math.random() > 0.5 ? 'inverted' : 'contango'}. Skew: ${skewDirection}-side +${(2 + Math.random() * 4).toFixed(1)} vol pts.`,
        type: 'volatility'
      },
      {
        index: 5,
        content: `5/5 Assessment: Conviction ${conviction.toUpperCase()}. Prob scenarios: Continuation ${45 + Math.floor(Math.random() * 15)}%, Mean reversion ${25 + Math.floor(Math.random() * 10)}%, Tail ${10 + Math.floor(Math.random() * 5)}%. Not advice. Sources: UW, consolidated tape. #DarkPoolData`,
        type: 'implications'
      }
    ];
  } else {
    const rawVolume = data.volume || data.size || 1500000;
    const volumeM = (rawVolume / 1000000).toFixed(2);
    const price = parseFloat(data.price) || 150;
    const notional = (rawVolume * price / 1000000).toFixed(1);
    const flowType = data.flowType || 'Accumulation';
    const venue = data.venue || 'DARK';
    
    thread = [
      {
        index: 1,
        content: `1/5 ALERT [${asOfTimestamp} ET]: Notable dark pool print. $${ticker} - ${volumeM}M shares ($${notional}M notional) at $${price.toFixed(2)}. ${advPercent}% of ADV. Venue: ${venue}. Print ${vwapDelta}% vs session VWAP. Tone: ${sentiment}.`,
        type: 'hook'
      },
      {
        index: 2,
        content: `2/5 Options Overlay via @unusual_whales: Net delta ${sentiment === 'bullish' ? 'positive' : 'negative'}. P/C ratio 0.${Math.floor(50 + Math.random() * 50)}. 25-delta RR at 6-mo ${sentiment === 'bearish' ? 'high' : 'low'}. ${skewDirection}-side premium ${(2 + Math.random() * 3).toFixed(1)} vol pts rich. Similar setup: ${historicalComparison}.`,
        type: 'context'
      },
      {
        index: 3,
        content: `3/5 Technicals: Print ${sentiment === 'bullish' ? 'above' : 'below'} 20 EMA. POC at $${(price * 0.995).toFixed(2)}. Key levels: S1 $${(price * 0.97).toFixed(2)}, R1 $${(price * 1.03).toFixed(2)}. Dealer ${dealerGamma}. Order flow: ${flowType.toLowerCase()} bias confirmed.`,
        type: 'technicals'
      },
      {
        index: 4,
        content: `4/5 Vol Surface: IV ${ivPercentile}th %ile. ATM ${(22 + Math.random() * 12).toFixed(1)}% vs HV20 ${(18 + Math.random() * 8).toFixed(1)}%. Term struct: front-month ${Math.random() > 0.5 ? 'elevated' : 'compressed'}. Skew ${skewDirection}-leaning. GEX imbalance near ${sentiment === 'bullish' ? 'support' : 'resistance'}.`,
        type: 'analytics'
      },
      {
        index: 5,
        content: `5/5 Assessment: Conviction ${conviction.toUpperCase()}. Scenarios: ${sentiment === 'bullish' ? 'Accumulation' : 'Distribution'} ${45 + Math.floor(Math.random() * 15)}%, Consolidation ${30 + Math.floor(Math.random() * 10)}%, Reversal ${10 + Math.floor(Math.random() * 5)}%. Monitor catalysts. Not advice. #DarkPoolData`,
        type: 'implications'
      }
    ];
  }
  
  const engagement = {
    impressions: Math.floor(Math.random() * 50000) + 5000,
    likes: Math.floor(Math.random() * 500) + 50,
    retweets: Math.floor(Math.random() * 100) + 10,
    replies: Math.floor(Math.random() * 50) + 5,
    bookmarks: Math.floor(Math.random() * 200) + 20,
  };

  // Generate chart SVG with session context for synchronized timestamps
  const basePrice = isOptions ? (data.strike || 150) : (parseFloat(data.price) || 150);
  const candles = generateSessionCandles(basePrice, 50, session, '15m');
  
  // Determine chart annotation based on sentiment
  const chartAnnotation = sentiment === 'bullish' 
    ? 'Notable accumulation pattern detected'
    : sentiment === 'bearish'
    ? 'Distribution pressure evident'
    : 'Neutral positioning, monitor for breakout';
  
  const chartSvg = generateChartSvg({
    ticker,
    timeframe: '15m',
    candles,
    session,
    darkPoolPrint: isOptions ? undefined : {
      time: candles[candles.length - 5]?.time || Date.now(),
      price: basePrice,
      size: data.value || data.volume || data.size || 1500000
    },
    levels: {
      vwap: basePrice * 0.998,
      ema20: basePrice * 1.002,
      ema50: basePrice * 0.995,
    },
    annotations: {
      explanation: chartAnnotation
    }
  });

  // Generate flow summary card SVG
  const flowSummarySvg = generateFlowSummarySvg({
    ticker,
    timestamp: session.asOfTime.toISOString(),
    eventType: isOptions ? 'options_sweep' : 'dark_pool',
    size: isOptions ? (data.contracts || 1000) : (data.size || data.volume || 50000),
    sizeUsd: isOptions ? (data.premium || 500000) : (data.value || (data.volume || data.size || 1500000) * (data.price || 100)),
    price: isOptions ? undefined : data.price,
    strike: isOptions ? data.strike : undefined,
    expiry: isOptions ? data.expiry : undefined,
    optionType: isOptions ? (data.type?.toLowerCase() as 'call' | 'put') : undefined,
    premium: isOptions ? data.premium : undefined,
    delta: isOptions ? data.delta : undefined,
    breakeven: isOptions ? (data.strike + (data.premium || 0) / 100) : undefined,
    sentiment,
    conviction: conviction as 'high' | 'medium' | 'low',
    venue: isOptions ? undefined : (data.venue || 'DARK')
  });

  // Generate institutional analytics charts with synchronized timestamps
  const sessionTimestamp = formatSessionTimestamp(session.asOfTime, 'short');
  
  const smileData = { ...generateMockVolatilitySmileData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
  const volatilitySmileSvg = generateVolatilitySmileSvg(smileData);

  const heatmapData = { ...generateMockOptionsFlowData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
  const optionsFlowHeatmapSvg = generateOptionsFlowHeatmapSvg(heatmapData);

  const oiData = { ...generateMockPutCallOIData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
  const putCallOILadderSvg = generatePutCallOILadderSvg(oiData);

  const ivData = { ...generateMockIVTermStructureData(ticker), asOfTimestamp: sessionTimestamp };
  const ivTermStructureSvg = generateIVTermStructureSvg(ivData);
  
  return {
    ticker,
    eventType: isOptions ? 'options_sweep' : 'dark_pool',
    thread,
    variant,
    conviction,
    sourceEvent: data,
    generatedAt: session.asOfTime.toISOString(),
    sentiment,
    engagement,
    chartSvg,
    flowSummarySvg,
    volatilitySmileSvg,
    optionsFlowHeatmapSvg,
    putCallOILadderSvg,
    ivTermStructureSvg,
    isLiveData
  };
}

function getApiKeyEnvVar(provider: string): string {
  const envVarMap: Record<string, string> = {
    "unusual_whales": "UNUSUAL_WHALES_API_KEY",
    "twitter": "TWITTER_CLIENT_ID",
    "polygon": "POLYGON_API_KEY",
    "alpha_vantage": "ALPHA_VANTAGE_API_KEY",
    "fmp": "FMP_API_KEY",
    "sec_edgar": "SEC_EDGAR_USER_AGENT",
  };
  return envVarMap[provider] || `${provider.toUpperCase()}_API_KEY`;
}

function getTwitterConfigured(): boolean {
  return !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET);
}
