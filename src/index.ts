#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWeatherServer } from "./weather-utils.js";
import { stderr } from "process";

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

// Override console methods to use stderr
console.log = log;
console.info = log;
console.warn = log;
console.debug = log;
console.error = log;

// Check if we should run in HTTP mode (for SSE/Claude Desktop)
const useHttp =
  process.argv.includes("--http") || process.env.USE_HTTP === "true";

if (useHttp) {
  log("Starting in HTTP mode for SSE transport...");
  log("MCP Inspector can connect to: http://localhost:8080/sse");
  import("./http-server.js");
} else {
  // Create server instance using the utility function
  const server = createWeatherServer();

  // Run with stdio transport (default)
  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("Weather MCP Server running on stdio");
  }

  main().catch((error) => {
    log("Fatal error in main():", error);
    process.exit(1);
  });
}
