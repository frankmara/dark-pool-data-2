import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
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
  x: integer("x").notNull(),
  y: integer("y").notNull(),
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
  status: varchar("status", { length: 20 }).default("disconnected"),
  lastSync: text("last_sync"),
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
