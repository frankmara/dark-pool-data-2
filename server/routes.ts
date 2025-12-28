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
  generateMockIVTermStructureData
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
  
  const ticker = data.ticker;
  const sentiment = isOptions 
    ? (data.type === 'CALL' ? 'bullish' : 'bearish')
    : (data.sentiment?.toLowerCase() || 'neutral');
  
  const convictions = ['high', 'medium', 'low'];
  const conviction = convictions[Math.floor(Math.random() * convictions.length)];
  
  const variants = ['neutral', 'bullish', 'bearish'];
  const variant = sentiment === 'bullish' ? 'bullish' : sentiment === 'bearish' ? 'bearish' : variants[Math.floor(Math.random() * variants.length)];
  
  const now = new Date();
  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  let thread: any[];
  
  if (isOptions) {
    const premium = data.premium;
    const strike = data.strike;
    const expiry = data.expiry;
    const optionType = data.type;
    const volume = data.volume?.toLocaleString() || '0';
    const oi = data.openInterest?.toLocaleString() || '0';
    
    thread = [
      {
        index: 1,
        content: `1/5 Institutional Alert: Anomalous ${optionType} sweep via @unusual_whales. $${ticker} - ${premium} premium at $${strike} strike, ${expiry} expiry. Volume ${volume} vs OI ${oi}. Delta-positive flow building.`,
        type: 'hook'
      },
      {
        index: 2,
        content: `2/5 Options Context: Put/call OI delta skewed. 25-delta risk-reversal at elevated levels. Flow breakdown: ${optionType === 'CALL' ? '70% bullish' : '65% bearish'} premium. Unusuality: 90th percentile volume concentration.`,
        type: 'context'
      },
      {
        index: 3,
        content: `3/5 Technical Context: Price testing key ${optionType === 'CALL' ? 'resistance' : 'support'} cluster. Gamma exposure concentrated near ${strike}. Vanna/charm pressure ${optionType === 'CALL' ? 'supportive' : 'resistive'} into expiry. Order flow confirms directional bias.`,
        type: 'technicals'
      },
      {
        index: 4,
        content: `4/5 Volatility Analysis: IV term structure elevated. 25-delta skew shows ${optionType === 'CALL' ? 'call' : 'put'}-side premium. Front-month IV in 85th percentile. Scenarios: 60% continuation, 30% consolidation, 10% reversal.`,
        type: 'volatility'
      },
      {
        index: 5,
        content: `5/5 Broader Implications: Monitor for earnings/macro catalysts. Not advice - due diligence required. Conviction: ${conviction.charAt(0).toUpperCase() + conviction.slice(1)}. Sources: Unusual Whales API, dark pool scanners. #InstitutionalResearch #OptionsFlow`,
        type: 'implications'
      }
    ];
  } else {
    const volume = (data.volume / 1000000).toFixed(1);
    const price = data.price;
    const flowType = data.flowType || 'Activity';
    
    thread = [
      {
        index: 1,
        content: `1/5 Institutional Alert: Anomalous dark pool print detected. $${ticker} - ${volume}M shares at $${price}. ${flowType} signal ~8% of ADV. Directional tone: ${sentiment}. Neutral alignment with volume POC.`,
        type: 'hook'
      },
      {
        index: 2,
        content: `2/5 Options Integration via @unusual_whales: Put/call OI delta skewed. 25-delta risk-reversal at 6-month ${sentiment === 'bearish' ? 'high' : 'low'}. Flow: ${sentiment === 'bullish' ? '65% bullish' : '60% bearish'} premium. Unusuality: 90th percentile volume.`,
        type: 'context'
      },
      {
        index: 3,
        content: `3/5 Technical Context: Print near ${sentiment === 'bullish' ? 'supportive' : 'resistive'} EMA cluster. Scenarios: Primary - ${sentiment === 'bullish' ? 'accumulation' : 'distribution'} (45% prob); Secondary - consolidation (40%); Tail - reversal (15%). Conviction: ${conviction.charAt(0).toUpperCase() + conviction.slice(1)}.`,
        type: 'technicals'
      },
      {
        index: 4,
        content: `4/5 Visual Analytics: Volatility smile shows ${sentiment === 'bearish' ? 'put' : 'call'}-side skew. IV changes ranked. Select data points flagged - likely off-exchange. Further probe recommended.`,
        type: 'analytics'
      },
      {
        index: 5,
        content: `5/5 Broader Implications: Monitor for year-end effects. Not advice - due diligence required. Sources: Unusual Whales API, dark pool scanners. #InstitutionalResearch #DarkPools`,
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

  // Generate chart SVG
  const basePrice = isOptions ? (data.strike || 150) : (data.price || 150);
  const candles = generateMockCandles(basePrice, 50);
  const chartSvg = generateChartSvg({
    ticker,
    timeframe: '15m',
    candles,
    darkPoolPrint: isOptions ? undefined : {
      time: candles[candles.length - 5]?.time || Date.now(),
      price: data.price || basePrice,
      size: data.value || data.volume || 1000000
    },
    levels: {
      vwap: basePrice * 0.998,
      ema20: basePrice * 1.002,
      ema50: basePrice * 0.995,
    }
  });

  // Generate flow summary card SVG
  const flowSummarySvg = generateFlowSummarySvg({
    ticker,
    timestamp: now.toISOString(),
    eventType: isOptions ? 'options_sweep' : 'dark_pool',
    size: isOptions ? (data.contracts || 1000) : (data.size || data.volume || 50000),
    sizeUsd: isOptions ? (data.premium || 500000) : (data.value || data.volume * (data.price || 100)),
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

  // Generate institutional analytics charts
  const smileData = generateMockVolatilitySmileData(ticker, basePrice);
  const volatilitySmileSvg = generateVolatilitySmileSvg(smileData);

  const heatmapData = generateMockOptionsFlowData(ticker, basePrice);
  const optionsFlowHeatmapSvg = generateOptionsFlowHeatmapSvg(heatmapData);

  const oiData = generateMockPutCallOIData(ticker, basePrice);
  const putCallOILadderSvg = generatePutCallOILadderSvg(oiData);

  const ivData = generateMockIVTermStructureData(ticker);
  const ivTermStructureSvg = generateIVTermStructureSvg(ivData);
  
  return {
    ticker,
    eventType: isOptions ? 'options_sweep' : 'dark_pool',
    thread,
    variant,
    conviction,
    sourceEvent: data,
    generatedAt: now.toISOString(),
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
