import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, jsonb, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Automation Settings Schema
export const automationSettings = pgTable("automation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterEnabled: boolean("master_enabled").default(false),
  darkPoolScanner: boolean("dark_pool_scanner").default(false),
  unusualOptionsSweeps: boolean("unusual_options_sweeps").default(false),
  autoThreadPosting: boolean("auto_thread_posting").default(false),
  analyticsTracking: boolean("analytics_tracking").default(true),
});

export const insertAutomationSettingsSchema = createInsertSchema(automationSettings).omit({ id: true });
export type InsertAutomationSettings = z.infer<typeof insertAutomationSettingsSchema>;
export type AutomationSettings = typeof automationSettings.$inferSelect;

// Scanner Configuration Schema
export const scannerConfig = pgTable("scanner_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true),
  refreshIntervalMs: integer("refresh_interval_ms").default(300000),
  darkPoolMinNotional: integer("dark_pool_min_notional").default(2000000),
  darkPoolMinAdvPercent: real("dark_pool_min_adv_percent").default(5),
  optionsMinPremium: integer("options_min_premium").default(1000000),
  optionsMinOiChangePercent: integer("options_min_oi_change_percent").default(500),
  optionsSweepMinSize: integer("options_sweep_min_size").default(500000),
  includeBlockTrades: boolean("include_block_trades").default(true),
  includeVenueImbalance: boolean("include_venue_imbalance").default(true),
  includeInsiderFilings: boolean("include_insider_filings").default(true),
  includeCatalystEvents: boolean("include_catalyst_events").default(true),
  lastRun: text("last_run"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const insertScannerConfigSchema = createInsertSchema(scannerConfig).omit({ id: true });
export type InsertScannerConfig = z.infer<typeof insertScannerConfigSchema>;
export type ScannerConfig = typeof scannerConfig.$inferSelect;

// Normalized Market Event Schema
export const marketEvents = pgTable("market_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  timestamp: text("timestamp").notNull(),
  source: varchar("source", { length: 50 }).notNull(),
  printSizeUsd: real("print_size_usd"),
  volume: integer("volume"),
  price: real("price"),
  venue: varchar("venue", { length: 50 }),
  side: varchar("side", { length: 10 }),
  premium: real("premium"),
  contracts: integer("contracts"),
  strike: real("strike"),
  expiry: text("expiry"),
  optionType: varchar("option_type", { length: 10 }),
  deltaExposure: real("delta_exposure"),
  gammaExposure: real("gamma_exposure"),
  openInterest: integer("open_interest"),
  oiChange: integer("oi_change"),
  oiChangePercent: real("oi_change_percent"),
  advPercent: real("adv_percent"),
  sentiment: varchar("sentiment", { length: 20 }),
  flowType: varchar("flow_type", { length: 30 }),
  isBlock: boolean("is_block").default(false),
  isSweep: boolean("is_sweep").default(false),
  isDarkPool: boolean("is_dark_pool").default(false),
  signalStrength: real("signal_strength"),
  metadata: jsonb("metadata"),
});

export const insertMarketEventSchema = createInsertSchema(marketEvents).omit({ id: true });
export type InsertMarketEvent = z.infer<typeof insertMarketEventSchema>;
export type MarketEvent = typeof marketEvents.$inferSelect;

// Posts Schema
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  variant: varchar("variant", { length: 10 }).default("A"),
  status: varchar("status", { length: 20 }).default("draft"),
  scheduledAt: text("scheduled_at"),
  postedAt: text("posted_at"),
  impressions: integer("impressions").default(0),
  engagements: integer("engagements").default(0),
  clicks: integer("clicks").default(0),
  retweets: integer("retweets").default(0),
  likes: integer("likes").default(0),
  replies: integer("replies").default(0),
  tags: text("tags").array(),
});

export const insertPostSchema = createInsertSchema(posts).omit({ id: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// Dark Pool Data Schema
export const darkPoolData = pgTable("dark_pool_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  volume: integer("volume").notNull(),
  price: text("price").notNull(),
  sentiment: varchar("sentiment", { length: 20 }),
  flowType: varchar("flow_type", { length: 20 }),
  timestamp: text("timestamp"),
});

export const insertDarkPoolDataSchema = createInsertSchema(darkPoolData).omit({ id: true });
export type InsertDarkPoolData = z.infer<typeof insertDarkPoolDataSchema>;
export type DarkPoolData = typeof darkPoolData.$inferSelect;

// Unusual Options Schema
export const unusualOptions = pgTable("unusual_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  strike: text("strike").notNull(),
  expiry: text("expiry").notNull(),
  type: varchar("type", { length: 10 }).notNull(),
  premium: text("premium").notNull(),
  volume: integer("volume").notNull(),
  openInterest: integer("open_interest").notNull(),
  timestamp: text("timestamp"),
});

export const insertUnusualOptionsSchema = createInsertSchema(unusualOptions).omit({ id: true });
export type InsertUnusualOptions = z.infer<typeof insertUnusualOptionsSchema>;
export type UnusualOptions = typeof unusualOptions.$inferSelect;

// Workflow Nodes Schema
export const workflowNodes = pgTable("workflow_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 30 }),
  positionX: integer("position_x").default(0),
  positionY: integer("position_y").default(0),
  active: boolean("active").default(true),
  config: jsonb("config"),
});

export const insertWorkflowNodeSchema = createInsertSchema(workflowNodes).omit({ id: true });
export type InsertWorkflowNode = z.infer<typeof insertWorkflowNodeSchema>;
export type WorkflowNode = typeof workflowNodes.$inferSelect;

// Workflow Connections Schema
export const workflowConnections = pgTable("workflow_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull(),
  targetId: varchar("target_id").notNull(),
});

export const insertWorkflowConnectionSchema = createInsertSchema(workflowConnections).omit({ id: true });
export type InsertWorkflowConnection = z.infer<typeof insertWorkflowConnectionSchema>;
export type WorkflowConnection = typeof workflowConnections.$inferSelect;

// API Connectors Schema
export const apiConnectors = pgTable("api_connectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 50 }),
  status: varchar("status", { length: 20 }).default("disconnected"),
  lastSync: text("last_sync"),
  lastError: text("last_error"),
  rateLimitRemaining: integer("rate_limit_remaining"),
  rateLimitReset: text("rate_limit_reset"),
  config: jsonb("config"),
});

export const insertApiConnectorSchema = createInsertSchema(apiConnectors).omit({ id: true });
export type InsertApiConnector = z.infer<typeof insertApiConnectorSchema>;
export type ApiConnector = typeof apiConnectors.$inferSelect;

// Analytics Data Schema
export const analyticsData = pgTable("analytics_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metric: varchar("metric", { length: 50 }).notNull(),
  value: integer("value").notNull(),
  change: text("change"),
  period: varchar("period", { length: 20 }),
  timestamp: text("timestamp"),
});

export const insertAnalyticsDataSchema = createInsertSchema(analyticsData).omit({ id: true });
export type InsertAnalyticsData = z.infer<typeof insertAnalyticsDataSchema>;
export type AnalyticsData = typeof analyticsData.$inferSelect;

// Keep users for any future auth needs
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// System Logs Schema
export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: text("timestamp").notNull(),
  component: varchar("component", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  message: text("message"),
  metadata: jsonb("metadata"),
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({ id: true });
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;

// Notification Channels Schema
export const notificationChannels = pgTable("notification_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  endpoint: text("endpoint").notNull(),
  enabled: boolean("enabled").default(true),
  config: jsonb("config"),
});

export const insertNotificationChannelSchema = createInsertSchema(notificationChannels).omit({ id: true });
export type InsertNotificationChannel = z.infer<typeof insertNotificationChannelSchema>;
export type NotificationChannel = typeof notificationChannels.$inferSelect;

// Alert Rules Schema
export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  alertType: varchar("alert_type", { length: 50 }).notNull(),
  enabled: boolean("enabled").default(true),
  threshold: real("threshold"),
  channelIds: text("channel_ids").array(),
  config: jsonb("config"),
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({ id: true });
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

// Health Snapshots Schema
export const healthSnapshots = pgTable("health_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  component: varchar("component", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  lastCheck: text("last_check").notNull(),
  message: text("message"),
  metrics: jsonb("metrics"),
});

export const insertHealthSnapshotSchema = createInsertSchema(healthSnapshots).omit({ id: true });
export type InsertHealthSnapshot = z.infer<typeof insertHealthSnapshotSchema>;
export type HealthSnapshot = typeof healthSnapshots.$inferSelect;

// Test Posts Schema - for preview mode (never posted)
export const testPosts = pgTable("test_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  thread: jsonb("thread").notNull(), // Array of tweet objects
  variant: varchar("variant", { length: 20 }).default("neutral"),
  conviction: varchar("conviction", { length: 20 }).default("medium"),
  sourceEvent: jsonb("source_event"),
  generatedAt: text("generated_at").notNull(),
  sentiment: varchar("sentiment", { length: 20 }),
  engagement: jsonb("engagement"), // Simulated engagement data
  chartSvg: text("chart_svg"), // TradingView-style chart SVG
  flowSummarySvg: text("flow_summary_svg"), // Flow summary card SVG
  isLiveData: boolean("is_live_data").default(false), // Whether this used live API data
});

export const insertTestPostSchema = createInsertSchema(testPosts).omit({ id: true });
export type InsertTestPost = z.infer<typeof insertTestPostSchema>;
export type TestPost = typeof testPosts.$inferSelect;

// Test Mode Settings Schema
export const testModeSettings = pgTable("test_mode_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").default(false),
  intervalMinutes: integer("interval_minutes").default(30),
  lastGenerated: text("last_generated"),
  autoGenerate: boolean("auto_generate").default(false),
});

export const insertTestModeSettingsSchema = createInsertSchema(testModeSettings).omit({ id: true });
export type InsertTestModeSettings = z.infer<typeof insertTestModeSettingsSchema>;
export type TestModeSettings = typeof testModeSettings.$inferSelect;
