#!/bin/bash
# Debug script for testing the Docker container with improved error reporting

echo "=== Debug Testing NZ Weather MCP Server Docker Container ==="
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

echo "Content of test request:"
cat /tmp/test-request.json
echo ""

# Run Docker container and capture both stdout and stderr
echo "Sending test request for Auckland weather..."
cat /tmp/test-request.json | docker run -i --rm --name nzweather-test nzweather-mcp-claude:latest > /tmp/test-response.txt 2> /tmp/test-error.txt

echo "--- Response from Docker container (stdout) ---"
cat /tmp/test-response.txt
echo "--- End of stdout response ---"

echo "--- Error output from Docker container (stderr) ---"
cat /tmp/test-error.txt
echo "--- End of stderr output ---"

# Check if the container might be having network issues
echo "--- Testing network connectivity inside a new container ---"
docker run --rm nzweather-mcp-claude:latest sh -c "wget -q --spider https://api.open-meteo.com && echo 'Network connection works!' || echo 'Network connection failed!'"

echo "=== Testing complete ==="
