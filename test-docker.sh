#!/bin/bash
# This script tests the Docker container directly to help debug weather forecast issues

echo "=== Testing NZ Weather MCP Server Docker Container ==="
echo "Running Docker container and testing get-nz-forecast tool..."

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
echo "Sending test request for Auckland weather..."
cat /tmp/test-request.json | docker run -i --rm nzweather-mcp-claude:latest > /tmp/test-response.txt

echo "--- Response from Docker container ---"
cat /tmp/test-response.txt
echo "--- End of response ---"

echo "=== Testing complete ==="
