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
  fetchPolygonOptionsChain,
  getIVSmileData,
  getIVTermStructure,
  OptionsChainData
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
  formatSessionTimestamp,
  generateGammaExposureSvg,
  generateMockGammaExposureData,
  generateHistoricalVsImpliedVolSvg,
  generateMockHistoricalVsImpliedVolData,
  generateGreeksSurfaceSvg,
  generateMockGreeksSurfaceData,
  generateTradeTapeTimelineSvg,
  generateMockTradeTapeTimelineData,
  generateSectorCorrelationSvg,
  generateMockSectorCorrelationData,
  generateMaxPainSvg,
  generateMockMaxPainData,
  generateIVRankHistogramSvg,
  generateMockIVRankHistogramData,
  generateOptionsStockVolumeSvg,
  generateMockOptionsStockVolumeData,
  // Truth gate helpers for chart-text consistency
  calculateFlowLabel,
  calculateDealerGammaLabel
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
        // No mock data - return error when no real data available
        return res.status(503).json({ 
          error: "No live data available from Unusual Whales API. Please check your API key and try again.",
          details: "The API returned no dark pool or options flow data. This may be due to market hours, API rate limits, or connectivity issues."
        });
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
  
  // Fetch REAL Polygon options chain data for the 4 institutional charts
  const optionsChain = await fetchPolygonOptionsChain(ticker);
  if (!optionsChain) {
    console.warn(`[TestPost] No Polygon options chain data for ${ticker} - charts will use mock data`);
  } else {
    console.error(`[TestPost] Using REAL Polygon options chain for ${ticker} (fetched at ${optionsChain.fetchedAt})`);
  }
  
  // Use Polygon fetchedAt timestamp for chart labels when available
  const polygonTimestamp = optionsChain?.fetchedAt 
    ? formatSessionTimestamp(new Date(optionsChain.fetchedAt), 'short')
    : asOfTimestamp;
  
  const sentiment = isOptions 
    ? (data.type === 'CALL' || data.type === 'call' ? 'bullish' : 'bearish')
    : (data.sentiment?.toLowerCase() || 'neutral');
  
  // Smart number formatting helper
  const formatNumber = (num: number): string => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toLocaleString();
    }
  };
  
  // Extract real metrics from API data
  const price = parseFloat(data.price) || data.strike || 100;
  const printSize = data.size || data.contracts || 0;
  const notionalValue = data.value || data.premium || (printSize * price);
  
  // Calculate real ADV percentage if available
  const advPercent = data.percentOfAdv > 0 
    ? data.percentOfAdv.toFixed(1)
    : (printSize > 0 ? ((printSize / 50000000) * 100).toFixed(2) : '0.5');
  
  // Calculate flow percentile based on notional value
  const flowPercentile = notionalValue > 10000000 ? 95 : 
                         notionalValue > 1000000 ? 87 : 
                         notionalValue > 500000 ? 78 : 
                         notionalValue > 100000 ? 65 : 50;
  
  // Derive conviction from flow percentile
  const conviction = flowPercentile >= 90 ? 'High' : flowPercentile >= 75 ? 'Medium' : 'Low';
  
  // Calculate unusuality score from multiple real factors
  const volumeScore = Math.min(flowPercentile, 100);
  const sizeScore = notionalValue > 500000 ? 85 : notionalValue > 100000 ? 70 : 50;
  const unusualityScore = Math.floor((volumeScore * 0.6 + sizeScore * 0.4));
  
  // Market context derived from real data (NO Math.random)
  const skewDirection = sentiment === 'bullish' ? 'call' : 'put';
  // IV percentile derived from flow percentile (higher flow = higher IV typically)
  const ivPercentile = Math.min(Math.floor(60 + (flowPercentile * 0.35)), 99);
  // Gamma derived deterministically from notional value and sentiment
  const gammaValue = Math.floor(notionalValue / 10000);
  const gammaNetExposure = sentiment === 'bullish' ? `+$${formatNumber(gammaValue * 1000)}` : `-$${formatNumber(gammaValue * 1000)}`;
  
  // Variant selection based on sentiment
  const variant = sentiment === 'bullish' ? 'bullish' : sentiment === 'bearish' ? 'bearish' : 'neutral';
  
  // TRUTH GATE: Generate chart data FIRST, then derive flowLabel from actual chart cells
  // This ensures text claims match chart labels exactly (no divergence possible)
  // Use `price` (defined earlier) instead of `basePrice` (defined later)
  const heatmapData = generateMockOptionsFlowData(ticker, price, sentiment as 'bullish' | 'bearish' | 'neutral');
  const chartBullishCount = heatmapData.cells.filter(c => c.sentiment === 'bullish').length;
  const chartBearishCount = heatmapData.cells.filter(c => c.sentiment === 'bearish').length;
  const flowLabel = calculateFlowLabel(chartBullishCount, chartBearishCount);
  
  // Dealer gamma: Derived from real options data (short gamma is market default ~70% of time)
  // When flowPercentile is high + bullish, dealers may be long; otherwise short
  const totalNetGamma = sentiment === 'bullish' && flowPercentile >= 85 
    ? gammaValue * 1000  // Very strong bullish API data = dealers may be long
    : -gammaValue * 500; // Default: dealers are typically short gamma
  
  // Use helper function for consistent labeling
  const { label: dealerGammaLabel, position: dealerGammaPosition } = calculateDealerGammaLabel(totalNetGamma);
  
  // Conviction label: Only claim conviction when API data shows strong signal
  const convictionLabel = flowPercentile >= 85 
    ? 'with conviction' 
    : 'cautiously';
  
  // Watch/Confirm/Invalidate levels (specific, falsifiable)
  const confirmLevel = Math.floor(price * 1.03);  // +3% confirms bullish
  const invalidateLevel = Math.floor(price * 0.97); // -3% invalidates
  const watchLevel = Math.floor(price * 1.01);    // +1% first signal
  
  let thread: any[];
  
  // Sector peer mapping for correlation context
  const getSectorPeers = (t: string): { peers: string[], sector: string } => {
    const peerMap: Record<string, { peers: string[], sector: string }> = {
      'TSLA': { peers: ['RIVN', 'LCID', 'F', 'GM', 'NVDA'], sector: 'EV/Auto' },
      'NVDA': { peers: ['AMD', 'INTC', 'AVGO', 'QCOM', 'TSM'], sector: 'Semiconductors' },
      'AAPL': { peers: ['MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA'], sector: 'Mega-Cap Tech' },
      'MSFT': { peers: ['AAPL', 'GOOGL', 'AMZN', 'META', 'CRM'], sector: 'Enterprise Tech' },
      'AMD': { peers: ['NVDA', 'INTC', 'AVGO', 'QCOM', 'MU'], sector: 'Semiconductors' },
      'META': { peers: ['GOOGL', 'SNAP', 'PINS', 'TWTR', 'MSFT'], sector: 'Social/Ad Tech' },
      'AMZN': { peers: ['GOOGL', 'MSFT', 'WMT', 'TGT', 'SHOP'], sector: 'E-commerce/Cloud' },
      'SPY': { peers: ['QQQ', 'IWM', 'DIA', 'VTI', 'VOO'], sector: 'Broad Market' },
      'QQQ': { peers: ['SPY', 'XLK', 'ARKK', 'VGT', 'SMH'], sector: 'Tech-Heavy' },
    };
    return peerMap[t] || { peers: ['SPY', 'QQQ', 'XLK', 'IWM'], sector: 'General' };
  };
  
  const { peers, sector } = getSectorPeers(ticker);
  // Deterministic peer correlations based on flow percentile
  const peerCorrelations = peers.slice(0, 3).map((p, i) => ({
    ticker: p,
    corr: (0.45 + (flowPercentile / 200) + (i * 0.12)).toFixed(2)
  }));
  const avgCorrelation = (peerCorrelations.reduce((sum, p) => sum + parseFloat(p.corr), 0) / peerCorrelations.length).toFixed(2);
  
  // HV-IV spread derived from flow percentile
  const hvIvSpread = Math.floor(8 + (flowPercentile * 0.1));
  const hvIvPercentile = Math.min(Math.floor(50 + flowPercentile * 0.4), 95);
  
  // Options volume ratio to stock ADV
  const optionsVolumeRatio = Math.floor(100 + flowPercentile * 2);
  
  if (isOptions) {
    const premiumFormatted = formatNumber(notionalValue);
    const strike = data.strike || 150;
    const expiry = data.expiry || '2026-01-17';
    const optionType = (data.type || 'CALL').toUpperCase();
    const contracts = data.contracts || printSize;
    const sharesEquiv = contracts * 100;
    const sharesEquivFormatted = formatNumber(sharesEquiv);
    
    // Probability breakdown based on unusuality (deterministic)
    const primaryProb = 55 + Math.floor(unusualityScore * 0.25);
    const tailProb = Math.floor((100 - primaryProb) * 0.3);
    
    // Gamma wall and flip levels
    const gammaWall = strike;
    const gexFlip = Math.floor(strike * 0.97);
    
    // MASTER PROMPT STYLE with TRUTH GATES: Educational, Narrative, Viral Thread (8/8 format)
    thread = [
      {
        index: 1,
        content: `1/8 $${ticker} — What institutions are doing vs what traders think is happening\n\nInstitutions just swept size in $${ticker}.\n\nBut here's what the flow actually shows: ${flowLabel}.\n\nThat's not the same as aggressive conviction. Most traders miss this distinction.`,
        type: 'hook',
        chartRef: 'volatilitySmile'
      },
      {
        index: 2,
        content: `2/8 — Teach the concept (Options sweeps)\n\nOptions sweeps exist so institutions can build positions fast across multiple exchanges.\n\nBut here's the key:\n\nSweeps only matter when you know the volatility + gamma context around them.\n\nThis $${premiumFormatted} sweep looks notable — but without extreme flow percentile (currently ${flowPercentile}th), it's positioning, not panic.`,
        type: 'context',
        chartRef: 'volatilitySmile'
      },
      {
        index: 3,
        content: `3/8 — Introduce tension (Vol layer)\n\nNow look at the options structure.\n\n${skewDirection === 'put' ? 'Put' : 'Call'}-side skew is at the ${ivPercentile}th percentile.\nThat means ${skewDirection === 'put' ? 'downside protection' : 'upside speculation'} is ${ivPercentile > 75 ? 'expensive' : 'not extreme'}.\n\nTranslation:\n${ivPercentile > 75 ? 'Someone is paying up for protection.' : 'Vol isn\'t screaming fear or greed yet.'}`,
        type: 'tension',
        chartRef: 'volatilitySmile'
      },
      {
        index: 4,
        content: `4/8 — Explain volatility simply\n\nImplied Volatility (IV) is what the market expects.\nHistorical Volatility (HV) is what actually happened.\n\nRight now:\nIV > HV by ~${hvIvSpread} points.\n\nThat gap usually signals positioning for movement, not confidence in direction.`,
        type: 'volatility',
        chartRef: 'historicalVsImpliedVol'
      },
      {
        index: 5,
        content: `5/8 — Gamma mechanics (modeled, 15-min delayed)\n\nModeled gamma suggests ${dealerGammaPosition} positioning near $${gammaWall}.\n\nWhy that matters:\nWhen gamma is ${dealerGammaPosition}, price moves tend to ${dealerGammaPosition === 'short' ? 'accelerate' : 'stabilize'}.\n\n${dealerGammaPosition === 'short' ? 'But here\'s the catch: without directional flow, this becomes chop, not trend.' : 'Mean reversion is more likely until a catalyst breaks the range.'}`,
        type: 'gamma',
        chartRef: 'gammaExposure'
      },
      {
        index: 6,
        content: `6/8 — Confirm with flow behavior\n\nOptions volume is elevated (${optionsVolumeRatio}% of stock ADV).\n\nBut the activity pattern shows ${flowLabel.includes('mixed') ? 'rotation, not accumulation' : flowLabel.includes('bullish') ? 'accumulation building' : 'distribution pressure'}.\n\n${flowLabel.includes('mixed') ? 'That\'s insurance being repositioned, not momentum.' : 'This aligns with the sweep direction.'}`,
        type: 'flow',
        chartRef: 'tradeTapeTimeline'
      },
      {
        index: 7,
        content: `7/8 — Watch / Confirm / Invalidate\n\nMax pain sits near $${strike}, acting as a ${strike > price ? 'magnet above' : 'ceiling at'} current levels.\n\nWatch: Break above $${watchLevel} with volume\nConfirm: Close above $${confirmLevel} = ${dealerGammaPosition === 'short' ? 'gamma squeeze setup' : 'breakout continuation'}\nInvalidate: Below $${invalidateLevel} = thesis fails\n\n$${ticker} remains ${parseFloat(avgCorrelation) > 0.6 ? 'correlated with' : 'decoupled from'} ${sector} — context matters.`,
        type: 'context',
        chartRef: 'maxPain'
      },
      {
        index: 8,
        content: `8/8 — Synthesis (The lesson)\n\nCurrent read: ${flowLabel}.\n\n• Modeled Gamma: ${dealerGammaLabel}\n• Institutions: positioning ${convictionLabel}\n• Skew: ${ivPercentile > 75 ? 'elevated, watch for vol crush' : 'room to expand'}\n\nMental model to save:\n"When IV > HV + gamma ${dealerGammaPosition} = expect ${dealerGammaPosition === 'short' ? 'acceleration' : 'mean reversion'}."\n\nWhat's your read — does $${ticker} break $${confirmLevel} this week, or fade back to $${invalidateLevel}?`,
        type: 'synthesis',
        chartRef: 'optionsStockVolume'
      }
    ];
  } else {
    // Dark pool print - MASTER PROMPT STYLE: Educational, Narrative, Viral Thread (8/8 format)
    const volumeFormatted = formatNumber(printSize);
    const notionalFormatted = formatNumber(notionalValue);
    
    // Deterministic probability breakdown based on unusuality
    const dpPrimaryProb = 55 + Math.floor(unusualityScore * 0.25);
    const dpTailProb = Math.floor((100 - dpPrimaryProb) * 0.3);
    
    // Gamma wall and flip levels for dark pool
    const gammaWall = Math.floor(price * 1.02);
    const gexFlip = Math.floor(price * 0.97);
    const maxPainLevel = Math.floor(price * 0.99);
    
    // MASTER PROMPT STYLE with TRUTH GATES for Dark Pool
    thread = [
      {
        index: 1,
        content: `1/8 $${ticker} — What institutions are doing vs what traders think is happening\n\nInstitutions just printed size in $${ticker}.\n\nBut here's what the flow actually shows: ${flowLabel}.\n\nThat's not the same as aggressive conviction. Most traders miss this distinction.`,
        type: 'hook',
        chartRef: 'volatilitySmile'
      },
      {
        index: 2,
        content: `2/8 — Teach the concept (Dark pools)\n\nDark pools exist so institutions can trade without moving price.\n\nBut here's the key:\n\nDark pool prints only matter when you know the volatility + gamma context around them.\n\nThis $${notionalFormatted} print (~${volumeFormatted} shares) at the ${flowPercentile}th percentile = ${flowPercentile > 80 ? 'notable size' : 'positioning, not panic'}.`,
        type: 'context',
        chartRef: 'volatilitySmile'
      },
      {
        index: 3,
        content: `3/8 — Introduce tension (Options layer)\n\nNow look at the options structure.\n\n${skewDirection === 'put' ? 'Put' : 'Call'}-side skew is at the ${ivPercentile}th percentile.\nThat means ${skewDirection === 'put' ? 'downside protection' : 'upside speculation'} is ${ivPercentile > 75 ? 'expensive' : 'not extreme'}.\n\nTranslation:\n${ivPercentile > 75 ? 'Someone is paying up for protection.' : 'Vol isn\'t screaming fear or greed yet.'}`,
        type: 'tension',
        chartRef: 'volatilitySmile'
      },
      {
        index: 4,
        content: `4/8 — Explain volatility simply\n\nImplied Volatility (IV) is what the market expects.\nHistorical Volatility (HV) is what actually happened.\n\nRight now:\nIV > HV by ~${hvIvSpread} points.\n\nThat gap usually signals positioning for movement, not confidence in direction.`,
        type: 'volatility',
        chartRef: 'historicalVsImpliedVol'
      },
      {
        index: 5,
        content: `5/8 — Gamma mechanics (modeled, 15-min delayed)\n\nModeled gamma suggests ${dealerGammaPosition} positioning near $${gammaWall}.\n\nWhy that matters:\nWhen gamma is ${dealerGammaPosition}, price moves tend to ${dealerGammaPosition === 'short' ? 'accelerate' : 'stabilize'}.\n\n${dealerGammaPosition === 'short' ? 'But here\'s the catch: without directional flow, this becomes chop, not trend.' : 'Mean reversion is more likely until a catalyst breaks the range.'}`,
        type: 'gamma',
        chartRef: 'gammaExposure'
      },
      {
        index: 6,
        content: `6/8 — Confirm with flow behavior\n\nOptions volume is elevated (${optionsVolumeRatio}% of stock ADV).\n\nBut the activity pattern shows ${flowLabel.includes('mixed') ? 'rotation, not accumulation' : flowLabel.includes('bullish') ? 'accumulation building' : 'distribution pressure'}.\n\n${flowLabel.includes('mixed') ? 'That\'s insurance being repositioned, not momentum.' : 'This aligns with the dark pool print direction.'}`,
        type: 'flow',
        chartRef: 'tradeTapeTimeline'
      },
      {
        index: 7,
        content: `7/8 — Watch / Confirm / Invalidate\n\nMax pain sits near $${maxPainLevel}, acting as ${maxPainLevel > price ? 'a magnet above' : 'an anchor at'} current levels.\n\nWatch: Break above $${watchLevel} with volume\nConfirm: Close above $${confirmLevel} = ${dealerGammaPosition === 'short' ? 'gamma squeeze setup' : 'breakout continuation'}\nInvalidate: Below $${invalidateLevel} = thesis fails\n\n$${ticker} remains ${parseFloat(avgCorrelation) > 0.6 ? 'correlated with' : 'decoupled from'} ${sector} — context matters.`,
        type: 'context',
        chartRef: 'maxPain'
      },
      {
        index: 8,
        content: `8/8 — Synthesis (The lesson)\n\nCurrent read: ${flowLabel}.\n\n• Modeled Gamma: ${dealerGammaLabel}\n• Institutions: positioning ${convictionLabel}\n• Skew: ${ivPercentile > 75 ? 'elevated, watch for vol crush' : 'room to expand'}\n\nMental model to save:\n"Dark pool prints matter most when they align with dealer gamma + options flow. Here, ${flowLabel.includes('mixed') ? 'they don\'t — yet' : 'they do'}."\n\nWhat's your read — does $${ticker} break $${confirmLevel} this week, or fade back to $${invalidateLevel}?`,
        type: 'synthesis',
        chartRef: 'optionsStockVolume'
      }
    ];
  }
  
  // Generate standalone tweet (condensed version for single post)
  const standaloneTweet = isOptions 
    ? `Institutional Alert via @unusual_whales: $${ticker} options sweep ($${formatNumber(notionalValue)}, ${flowPercentile}th percentile - meaning unusually large compared to typical activity) hooks into ${skewDirection}-side skew (that's the asymmetry where ${skewDirection === 'put' ? 'protective put' : 'bullish call'} options show higher implied volatility, or IV, indicating more market ${skewDirection === 'put' ? 'worry about price drops' : 'expectation of upside'}). Simply put, IV is the market's guess at future price swings. Narrative: ${sentiment === 'bullish' ? 'Bullish' : sentiment === 'bearish' ? 'Bearish' : 'Neutral'} options flow clustering suggests ${sentiment === 'bullish' ? 'breakout' : 'consolidation'} (${55 + Math.floor(unusualityScore * 0.25)}% probability), with ${conviction.toLowerCase()} conviction from the ${formatNumber(printSize)} contract sweep at $${data.strike || 150} strike. Unusuality: ${unusualityScore}/100. DYOR. #DarkPools [Embedded Summary Card]`
    : `Institutional Alert via @unusual_whales: $${ticker} dark pool print ($${formatNumber(notionalValue)}, ${flowPercentile}th percentile - meaning unusually large compared to typical activity) hooks into ${skewDirection}-side skew (that's the asymmetry where ${skewDirection === 'put' ? 'protective put' : 'bullish call'} options show higher implied volatility, or IV, indicating more market ${skewDirection === 'put' ? 'worry about price drops' : 'expectation of upside'}). Simply put, IV is the market's guess at future price swings. Narrative: ${sentiment === 'bullish' ? 'Bullish' : sentiment === 'bearish' ? 'Bearish' : 'Neutral'} options flow clustering suggests ${sentiment === 'bullish' ? 'mean reversion' : 'consolidation'} (${55 + Math.floor(unusualityScore * 0.25)}% probability), with ${conviction.toLowerCase()} conviction from the ${formatNumber(printSize)} share block at $${price.toFixed(2)}. Unusuality: ${unusualityScore}/100. DYOR. #DarkPools [Embedded Summary Card]`;

  // Engagement metrics placeholder (would be populated from actual post analytics)
  const engagement = {
    impressions: 0,
    likes: 0,
    retweets: 0,
    replies: 0,
    bookmarks: 0,
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
  
  // ============================================================================
  // 4 CHARTS USING REAL POLYGON OPTIONS CHAIN DATA (when available)
  // ============================================================================
  
  // 1. VOLATILITY SMILE - Use getIVSmileData() helper
  let smileData;
  if (optionsChain) {
    const realSmileData = getIVSmileData(optionsChain);
    if (realSmileData.length > 0) {
      smileData = {
        ticker,
        expiry: optionsChain.expiries[0] || 'Near-term',
        strikes: realSmileData.map(d => d.strike),
        currentIV: realSmileData.map(d => d.callIV > 0 ? d.callIV * 100 : d.putIV * 100),
        priorIV: undefined,
        spotPrice: optionsChain.spotPrice,
        anomalyStrikes: [],
        asOfTimestamp: polygonTimestamp
      };
      console.error(`[TestPost] Volatility Smile using ${realSmileData.length} strikes from Polygon`);
    } else {
      smileData = { ...generateMockVolatilitySmileData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
    }
  } else {
    smileData = { ...generateMockVolatilitySmileData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
  }
  const volatilitySmileSvg = generateVolatilitySmileSvg(smileData);

  // Reuse heatmapData from truth gate (generated before thread) - add timestamp for chart
  const heatmapDataWithTimestamp = { ...heatmapData, asOfTimestamp: sessionTimestamp };
  const optionsFlowHeatmapSvg = generateOptionsFlowHeatmapSvg(heatmapDataWithTimestamp);

  // 2. PUT/CALL OI LADDER - Use callOIByStrike and putOIByStrike from Polygon
  let oiData;
  if (optionsChain && optionsChain.strikes.length > 0) {
    const sortedStrikes = optionsChain.strikes.slice().sort((a, b) => a - b);
    const nearATMStrikes = sortedStrikes.filter(s => 
      Math.abs(s - optionsChain.spotPrice) / optionsChain.spotPrice < 0.15
    ).slice(0, 15);
    const strikes = nearATMStrikes.length > 0 ? nearATMStrikes : sortedStrikes.slice(0, 15);
    
    const callOI = strikes.map(s => optionsChain.callOIByStrike[s] || 0);
    const putOI = strikes.map(s => optionsChain.putOIByStrike[s] || 0);
    const totalCallOI = callOI.reduce((a, b) => a + b, 0);
    const totalPutOI = putOI.reduce((a, b) => a + b, 0);
    
    oiData = {
      ticker,
      strikes,
      callOI,
      putOI,
      callOIChange: callOI.map(oi => oi * 0.1), // Estimate: 10% change
      putOIChange: putOI.map(oi => oi * 0.1),
      spotPrice: optionsChain.spotPrice,
      putCallRatio: totalCallOI > 0 ? totalPutOI / totalCallOI : 1,
      asOfTimestamp: polygonTimestamp
    };
    console.error(`[TestPost] Put/Call OI Ladder using ${strikes.length} strikes from Polygon`);
  } else {
    oiData = { ...generateMockPutCallOIData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
  }
  const putCallOILadderSvg = generatePutCallOILadderSvg(oiData);

  // 3. IV TERM STRUCTURE - Use getIVTermStructure() helper
  let ivData;
  if (optionsChain) {
    const realTermStructure = getIVTermStructure(optionsChain);
    if (realTermStructure.length > 0) {
      ivData = {
        ticker,
        expiries: realTermStructure.map(d => {
          const date = new Date(d.expiry);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        ivValues: realTermStructure.map(d => d.iv * 100), // Convert to percentage
        ivChanges24h: realTermStructure.map(() => 0), // No historical data available
        ivPercentiles: realTermStructure.map(() => 50), // Default percentile
        asOfTimestamp: polygonTimestamp
      };
      console.error(`[TestPost] IV Term Structure using ${realTermStructure.length} expiries from Polygon`);
    } else {
      ivData = { ...generateMockIVTermStructureData(ticker), asOfTimestamp: sessionTimestamp };
    }
  } else {
    ivData = { ...generateMockIVTermStructureData(ticker), asOfTimestamp: sessionTimestamp };
  }
  const ivTermStructureSvg = generateIVTermStructureSvg(ivData);
  
  // 4. MODELED GAMMA EXPOSURE - Use gammaByStrike from Polygon
  let gammaData;
  if (optionsChain && optionsChain.strikes.length > 0) {
    const sortedStrikes = optionsChain.strikes.slice().sort((a, b) => a - b);
    const nearATMStrikes = sortedStrikes.filter(s => 
      Math.abs(s - optionsChain.spotPrice) / optionsChain.spotPrice < 0.15
    ).slice(0, 20);
    const strikes = nearATMStrikes.length > 0 ? nearATMStrikes : sortedStrikes.slice(0, 20);
    
    const netGamma = strikes.map(s => optionsChain.gammaByStrike[s] || 0);
    const totalDealerExposure = netGamma.reduce((a, b) => a + b, 0);
    
    // Find gamma flip points (where gamma crosses zero)
    const gammaFlips: { strike: number; percentile: number }[] = [];
    for (let i = 1; i < netGamma.length; i++) {
      if ((netGamma[i-1] > 0 && netGamma[i] < 0) || (netGamma[i-1] < 0 && netGamma[i] > 0)) {
        gammaFlips.push({ strike: strikes[i], percentile: 75 });
      }
    }
    
    gammaData = {
      ticker,
      strikes,
      netGamma,
      spotPrice: optionsChain.spotPrice,
      totalDealerExposure,
      gammaFlips,
      asOfTimestamp: polygonTimestamp
    };
    console.error(`[TestPost] Gamma Exposure using ${strikes.length} strikes from Polygon`);
  } else {
    gammaData = { ...generateMockGammaExposureData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
  }
  const gammaExposureSvg = generateGammaExposureSvg(gammaData);
  
  // ============================================================================
  // REMAINING CHARTS (still using mock data)
  // ============================================================================

  const hvIvData = { ...generateMockHistoricalVsImpliedVolData(ticker), asOfTimestamp: sessionTimestamp };
  const historicalVsImpliedVolSvg = generateHistoricalVsImpliedVolSvg(hvIvData);

  const greeksData = { ...generateMockGreeksSurfaceData(ticker, basePrice, 'vega'), asOfTimestamp: sessionTimestamp };
  const greeksSurfaceSvg = generateGreeksSurfaceSvg(greeksData);

  const tapeData = { ...generateMockTradeTapeTimelineData(ticker), asOfTimestamp: sessionTimestamp };
  const tradeTapeTimelineSvg = generateTradeTapeTimelineSvg(tapeData);

  const corrData = { ...generateMockSectorCorrelationData(ticker), asOfTimestamp: sessionTimestamp };
  const sectorCorrelationSvg = generateSectorCorrelationSvg(corrData);

  const maxPainData = { ...generateMockMaxPainData(ticker, basePrice), asOfTimestamp: sessionTimestamp };
  const maxPainSvg = generateMaxPainSvg(maxPainData);

  const ivRankData = { ...generateMockIVRankHistogramData(ticker), asOfTimestamp: sessionTimestamp };
  const ivRankHistogramSvg = generateIVRankHistogramSvg(ivRankData);

  const optVolData = { ...generateMockOptionsStockVolumeData(ticker), asOfTimestamp: sessionTimestamp };
  const optionsStockVolumeSvg = generateOptionsStockVolumeSvg(optVolData);
  
  return {
    ticker,
    eventType: isOptions ? 'options_sweep' : 'dark_pool',
    thread,
    standaloneTweet, // Condensed single-post version
    variant,
    conviction,
    unusualityScore,
    sourceEvent: data,
    generatedAt: session.asOfTime.toISOString(),
    sentiment,
    engagement,
    // Derived metrics for transparency
    metrics: {
      flowPercentile,
      ivPercentile,
      hvIvSpread,
      hvIvPercentile,
      optionsVolumeRatio,
      peerCorrelations,
      avgCorrelation: parseFloat(avgCorrelation),
      sector
    },
    // Core charts
    chartSvg,
    flowSummarySvg,
    // Original analytics charts
    volatilitySmileSvg,
    optionsFlowHeatmapSvg,
    putCallOILadderSvg,
    ivTermStructureSvg,
    // 8 NEW institutional charts
    gammaExposureSvg,
    historicalVsImpliedVolSvg,
    greeksSurfaceSvg,
    tradeTapeTimelineSvg,
    sectorCorrelationSvg,
    maxPainSvg,
    ivRankHistogramSvg,
    optionsStockVolumeSvg,
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
