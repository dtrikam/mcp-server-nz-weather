#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createWeatherServer } from "./weather-utils.js";
import { stderr } from "process";

// Create the main MCP server
const server = createWeatherServer();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Configure logging to use stderr only
const log = (...args: any[]) => {
  stderr.write(
    args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ") + "\n"
  );
};

// Override all console methods to use stderr
console.log = log;
console.info = log;
console.warn = log;
console.debug = log;
console.error = log;

// Basic info route
app.get("/", (req, res) => {
  res.json({
    name: "NZ Weather MCP Server",
    description: "MCP Server for weather data including New Zealand cities",
    version: "1.0.0",
    endpoints: {
      "/": "This information",
      "/sse": "MCP Server-Sent Events endpoint for Claude Desktop",
    },
  });
});

// Handle MCP SSE connections
app.get("/sse", async (req, res) => {
  log("New SSE connection request received");

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Keep track of heartbeat interval
  let heartbeatInterval: NodeJS.Timeout | null = null;

  try {
    // Create SSE transport
    const transport = new SSEServerTransport("/messages", res);

    // Start heartbeat after connection is established
    heartbeatInterval = setInterval(() => {
      try {
        res.write(":\n\n"); // SSE comment for heartbeat
      } catch (error) {
        log("Error sending heartbeat:", error);
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      }
    }, 15000);

    // Connect server to transport
    await server.connect(transport);

    // Handle cleanup
    const cleanup = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      log("SSE connection closed");
    };

    req.on("close", cleanup);
    req.on("error", (error) => {
      log("SSE connection error:", error);
      cleanup();
    });
  } catch (error) {
    log("Error in SSE connection:", error);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    res.end();
  }
});

// Handle incoming MCP messages
app.post("/messages", express.json(), (req, res) => {
  try {
    const message = req.body;

    // Validate message format
    if (
      !message ||
      typeof message !== "object" ||
      !message.jsonrpc ||
      !message.method
    ) {
      throw new Error(
        "Invalid message format - missing required JSON-RPC fields"
      );
    }

    // Log message details to stderr
    log("Received message:", message);

    // Only respond with JSON
    res.status(200).json({ status: "ok" });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log("Error processing message:", errorMessage);
    res.status(400).json({
      error: {
        code: -32700,
        message: "Parse error",
        data: { details: errorMessage },
      },
    });
  }
});

// Create HTTP server
const httpServer = createServer(app);

// Start server silently (logging only to stderr)
const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
httpServer.listen(port, () => {
  log(`MCP Weather Server running at http://localhost:${port}`);
  log(`SSE endpoint available at http://localhost:${port}/sse`);
});
