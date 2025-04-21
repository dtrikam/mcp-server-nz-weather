// A simple test script to debug the MCP server
const { createMcpClient } = require("@modelcontextprotocol/sdk/client/mcp");

async function main() {
  try {
    // Create a client connecting to the stdio transport
    const client = createMcpClient({
      transport: {
        type: "stdio",
        command: "docker",
        args: [
          "run",
          "-i",
          "--rm",
          "--init",
          "-e",
          "DOCKER_CONTAINER=true",
          "nzweather-mcp-claude:latest",
        ],
      },
    });

    // Get server capabilities
    const serverCapabilities = await client.getCapabilities();
    console.log(
      "Server capabilities:",
      JSON.stringify(serverCapabilities, null, 2)
    );

    // Call the get-nz-forecast tool
    console.log("\nCalling get-nz-forecast for Auckland...");
    try {
      const result = await client.callTool("get-nz-forecast", {
        city: "Auckland",
      });
      console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Error calling get-nz-forecast:", error);
    }

    // Close the client
    await client.close();
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
