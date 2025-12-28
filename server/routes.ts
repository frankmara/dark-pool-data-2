import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, insertDarkPoolDataSchema, insertUnusualOptionsSchema, insertApiConnectorSchema, insertWorkflowNodeSchema, insertWorkflowConnectionSchema, insertAnalyticsDataSchema } from "@shared/schema";

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

  return httpServer;
}
