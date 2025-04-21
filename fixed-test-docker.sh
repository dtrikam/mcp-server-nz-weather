#!/bin/bash
# Fixed test script for Docker container to properly handle stderr/stdout separation

echo "=== Fixed Test: NZ Weather MCP Server Docker Container ==="
echo "Running Docker container with improved response handling..."

# Create a temporary request file
cat > /tmp/test-request.json << EOL
{
  "type": "toolRequest",
  "id": "test-1",
  "tool": "get-nz-forecast",
  "params": {
    "city": "Auckland"
  }
}
EOL

# Run Docker container and pipe the test request to it
# Capture both stdout and stderr to properly see the response
echo "Sending test request for Auckland weather..."
cat /tmp/test-request.json | docker run -i --rm nzweather-mcp-claude:latest > /tmp/test-response.txt 2> /tmp/test-stderr.txt

echo "--- MCP Server logs (stderr) ---"
cat /tmp/test-stderr.txt
echo "--- End of logs ---"

echo "--- MCP Response (stdout) ---"
cat /tmp/test-response.txt | grep -v "Weather MCP Server"
echo "--- End of response ---"

echo "=== Test complete ==="
