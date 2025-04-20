@description('The name of the project')
param projectName string = 'nzweather'

@description('The environment (dev, test, prod)')
param environment string = 'dev'

@description('The location for all resources')
param location string = resourceGroup().location

@description('The SKU for the Container Registry')
param acrSku string = 'Basic'

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

// Output the Container Registry login server
output acrLoginServer string = acr.properties.loginServer
output acrName string = acrName
