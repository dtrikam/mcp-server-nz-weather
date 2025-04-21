#!/bin/bash
# This script builds and deploys the NZ Weather MCP Server to Azure

# Exit on error
set -e

# Variables
RESOURCE_GROUP="nzweather-rg"
LOCATION="australiaeast"  # Default location - can be overridden in parameters.json

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Azure CLI is not installed. Please install it first."
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if user is logged in to Azure
echo "Checking Azure login status..."
az account show &> /dev/null || { 
    echo "You're not logged in to Azure. Running 'az login'..."
    az login
}

# Create resource group if it doesn't exist
echo "Creating resource group if it doesn't exist..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# Build the TypeScript project
echo "Building TypeScript project..."
npm install
npm run build

# Create ACR using Bicep and get the ACR name from the output
echo "Creating Azure Container Registry..."
ACR_NAME=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file ./infra/acr.bicep \
    --parameters ./infra/parameters.json \
    --query "properties.outputs.acrName.value" \
    --output tsv)

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group "$RESOURCE_GROUP" --query loginServer --output tsv)

echo "Using ACR name: $ACR_NAME"
echo "ACR Login Server: $ACR_LOGIN_SERVER"

# Log in to ACR
echo "Logging in to Azure Container Registry..."
az acr login --name $ACR_NAME

# Build and push Docker image
echo "Building and pushing Docker image to ACR..."
docker build --platform linux/amd64 -t $ACR_LOGIN_SERVER/nzweather-mcp:latest .
docker push $ACR_LOGIN_SERVER/nzweather-mcp:latest

# Build and push Claude-compatible Docker image
echo "Building and pushing Claude-compatible Docker image to ACR..."
docker build --platform linux/amd64 -t $ACR_LOGIN_SERVER/nzweather-mcp-claude:latest -f Dockerfile.claude .
docker push $ACR_LOGIN_SERVER/nzweather-mcp-claude:latest

# Verify the images exist
echo "Verifying images exist in registry..."
IMAGE_EXISTS=$(az acr repository show --name $ACR_NAME --image nzweather-mcp:latest --query name -o tsv 2>/dev/null || echo "not_found")
if [ "$IMAGE_EXISTS" == "not_found" ]; then
  echo "Failed to find image in ACR. Deployment cannot continue."
  exit 1
fi
echo "Image verified in Container Registry!"

# Now deploy the rest of the resources
echo "Deploying remaining Azure resources (Container App)..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file ./infra/main.bicep \
    --parameters ./infra/parameters.json \
    --output none

# Get Container App URL
CONTAINER_APP_URL=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "main" \
    --query "properties.outputs.containerAppURL.value" \
    --output tsv)

echo "Deployment completed successfully!"
echo "Your MCP server is running at: $CONTAINER_APP_URL"
