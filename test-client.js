#!/usr/bin/env node

import { spawn } from "child_process";
import { createInterface } from "readline";

// Start the MCP server as a child process
const serverProcess = spawn("node", ["build/index.js"], {
  stdio: ["pipe", "pipe", "inherit"],
});

// Create readline interface for both input and output
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Sample MCP protocol messages
const sampleRequests = {
  getAlerts: {
    jsonrpc: "2.0",
    id: "1",
    method: "tool",
    params: {
      name: "get-alerts",
      parameters: {
        state: "CA",
      },
    },
  },
  getForecast: {
    jsonrpc: "2.0",
    id: "2",
    method: "tool",
    params: {
      name: "get-forecast",
      parameters: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    },
  },
};

// Listen for server output
serverProcess.stdout.on("data", (data) => {
  try {
    // Try to parse the response as JSON
    const response = JSON.parse(data.toString());
    console.log("Received response from server:");
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    // If it's not valid JSON, just print it as is
    console.log("Server output:", data.toString());
  }
});

// Function to send a request to the server
function sendRequest(request) {
  const requestStr = JSON.stringify(request);
  console.log(`Sending request: ${requestStr}`);
  serverProcess.stdin.write(requestStr + "\n");
}

// Menu system
function showMenu() {
  console.log("\n----- MCP Weather Server Test Client -----");
  console.log("1. Get weather alerts for a state");
  console.log("2. Get weather forecast for a location");
  console.log("3. Exit");
  console.log("-----------------------------------------");

  rl.question("Select an option: ", (answer) => {
    switch (answer) {
      case "1":
        rl.question("Enter two-letter state code (e.g., CA, NY): ", (state) => {
          const request = JSON.parse(JSON.stringify(sampleRequests.getAlerts));
          request.params.parameters.state = state.toUpperCase();
          sendRequest(request);
          setTimeout(showMenu, 1000); // Wait a bit before showing the menu again
        });
        break;
      case "2":
        rl.question("Enter latitude (e.g., 37.7749): ", (lat) => {
          rl.question("Enter longitude (e.g., -122.4194): ", (lng) => {
            const request = JSON.parse(
              JSON.stringify(sampleRequests.getForecast)
            );
            request.params.parameters.latitude = parseFloat(lat);
            request.params.parameters.longitude = parseFloat(lng);
            sendRequest(request);
            setTimeout(showMenu, 1000); // Wait a bit before showing the menu again
          });
        });
        break;
      case "3":
        console.log("Exiting...");
        serverProcess.kill();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log("Invalid option. Please try again.");
        showMenu();
    }
  });
}

// Start the menu
console.log("Starting MCP Weather Server Test Client...");
// Wait a moment for the server to start up
setTimeout(showMenu, 1000);

// Handle cleanup
process.on("SIGINT", () => {
  console.log("Shutting down...");
  serverProcess.kill();
  rl.close();
  process.exit(0);
});
