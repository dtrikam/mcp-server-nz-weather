#!/bin/bash
# Network test script for the Docker container

echo "=== Testing Network Connectivity ==="

# Run a more detailed network test
echo "Running detailed network test in Docker container..."
docker run --rm nzweather-mcp-claude:latest sh -c "apk add --no-cache curl && \
  echo 'Testing direct API URL:' && \
  curl -v 'https://api.open-meteo.com/v1/forecast?latitude=-36.8509&longitude=174.7645&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5'"

echo "=== Network Test Complete ==="
