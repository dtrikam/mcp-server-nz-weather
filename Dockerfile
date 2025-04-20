FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the built JavaScript files
COPY build/ ./build/

# Set environment variables
ENV NODE_ENV=production
ENV USE_HTTP=true
ENV PORT=8080

# Expose the port the app runs on
EXPOSE 8080

# Run the MCP server with HTTP transport enabled
CMD ["node", "build/index.js", "--http"]
