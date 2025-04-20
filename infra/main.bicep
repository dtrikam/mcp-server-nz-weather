@description('The name of the project')
param projectName string = 'nzweather'

@description('The environment (dev, test, prod)')
param environment string = 'dev'

@description('The location for all resources')
param location string = resourceGroup().location

@description('The SKU for the Container Registry')
param acrSku string = 'Basic'

@description('The name for the Container Apps Environment')
param containerAppsEnvName string = '${projectName}-env-${environment}'

var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 5)
var acrName = '${projectName}acr${uniqueSuffix}'

// Create Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2021-12-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: acrSku
  }
  properties: {
    adminUserEnabled: true
  }
}

// Create Log Analytics workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: '${projectName}-logs-${environment}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Create Container Apps Environment
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2022-03-01' = {
  name: containerAppsEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// Create Container App
resource containerApp 'Microsoft.App/containerApps@2022-03-01' = {
  name: '${projectName}-app-${environment}'
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
      }
      registries: [
        {
          server: '${acrName}.azurecr.io'
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'nzweather-mcp'
          image: '${acrName}.azurecr.io/nzweather-mcp:latest'
          resources: {
            cpu: json('0.5')  // Using json() to parse the string as a number
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'USE_HTTP'
              value: 'true'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

// Output the Container Registry login server and Container App URL
output acrLoginServer string = acr.properties.loginServer
output containerAppURL string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
