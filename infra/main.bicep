targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Nom de l environnement Azure Developer CLI.')
param environmentName string

@minLength(1)
@description('Region Azure de deploiement.')
param location string

@minLength(1)
@description('Compte administrateur du serveur Azure SQL.')
param sqlAdminLogin string = 'kaizenadmin'

@secure()
@minLength(12)
@description('Mot de passe administrateur Azure SQL. Il est fourni par SQL_ADMIN_PASSWORD et n est pas stocke dans Git.')
param sqlAdminPassword string

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
  application: 'kaizen-toolbox'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-kaizen-${environmentName}'
  location: location
  tags: tags
}

module application './resources.bicep' = {
  name: 'kaizen-resources'
  scope: resourceGroup
  params: {
    location: location
    resourceToken: resourceToken
    sqlAdminLogin: sqlAdminLogin
    sqlAdminPassword: sqlAdminPassword
    tags: tags
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup.name
output SERVICE_WEB_NAME string = application.outputs.webAppName
output SERVICE_WEB_URI string = application.outputs.webAppUri
output AZURE_SQL_DATABASE_NAME string = application.outputs.sqlDatabaseName
output AZURE_SQL_SERVER_NAME string = application.outputs.sqlServerName
