#!/bin/bash
# Improved script for testing the Docker container with better debugging

echo "=== Testing NZ Weather MCP Server Docker Container ==="

# Make sure the container is built with the right Dockerfile
echo "Rebuilding container from Dockerfile.claude..."
docker build -t nzweather-mcp-claude:latest -f Dockerfile.claude .

# Create a temporary request file
echo "Creating test request for Auckland weather..."
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

# Run Docker container with network test first
echo "Testing network connectivity in container..."
docker run --rm nzweather-mcp-claude:latest sh -c "wget -q --spider https://api.open-meteo.com && echo 'Network connection works!' || echo 'Network connection failed!'"

# Run Docker container with the test request and give it time to process
echo "Sending test request to container..."
cat /tmp/test-request.json | docker run -i --rm nzweather-mcp-claude:latest > /tmp/test-response.txt

# Display the response
echo "--- Response from Docker container ---"
cat /tmp/test-response.txt
echo "--- End of response ---"

# Check if the response is empty or just contains the startup message
if ! grep -q "forecast" /tmp/test-response.txt; then
  echo "ISSUE DETECTED: No forecast data returned"
  echo "This could be due to network connectivity problems or response formatting issues"
  echo "Try running the Docker container with network debugging:"
  echo "docker run --rm -it nzweather-mcp-claude:latest sh"
fi

echo "=== Testing complete ==="
