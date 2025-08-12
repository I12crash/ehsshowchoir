Param(
  [string]$Region = "us-east-2",
  [string]$Stack  = "ShowChoirBillingStack",
  [string]$CallbackDefault = "http://localhost:5173/callback"
)

Write-Host "Resolving outputs for $Stack in $Region..."

$API_URL = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text --region $Region
$SITE_BUCKET = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" --output text --region $Region
$CF_DOMAIN = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" --output text --region $Region
$DIST_ID = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text --region $Region
$COGNITO_DOMAIN = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='HostedUIDomain'].OutputValue" --output text --region $Region
$USER_POOL_CLIENT_ID = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text --region $Region

if ([string]::IsNullOrWhiteSpace($SITE_BUCKET) -or $SITE_BUCKET -eq "None") {
  $SITE_BUCKET = aws cloudformation describe-stack-resources --stack-name $Stack `
    --query "StackResources[?ResourceType=='AWS::S3::Bucket' && starts_with(LogicalResourceId, 'SiteBucket')].PhysicalResourceId" `
    --output text --region $Region
}

if ([string]::IsNullOrWhiteSpace($DIST_ID) -or $DIST_ID -eq "None") {
  if (-not [string]::IsNullOrWhiteSpace($CF_DOMAIN) -and $CF_DOMAIN -ne "None") {
    $DIST_ID = aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='$CF_DOMAIN'].Id" --output text
  }
  if ([string]::IsNullOrWhiteSpace($DIST_ID) -or $DIST_ID -eq "None") {
    $DIST_ID = aws cloudformation describe-stack-resources --stack-name $Stack `
      --query "StackResources[?ResourceType=='AWS::CloudFront::Distribution'].PhysicalResourceId" `
      --output text --region $Region
  }
}

if ([string]::IsNullOrWhiteSpace($API_URL) -or $API_URL -eq "None") { throw "Could not resolve API_URL" }
if ([string]::IsNullOrWhiteSpace($SITE_BUCKET) -or $SITE_BUCKET -eq "None") { throw "Could not resolve SITE_BUCKET" }

Write-Host "API_URL=$API_URL"
Write-Host "SITE_BUCKET=$SITE_BUCKET"
Write-Host "CF_DOMAIN=$CF_DOMAIN"
Write-Host "DIST_ID=$DIST_ID"
Write-Host "COGNITO_DOMAIN=$COGNITO_DOMAIN"
Write-Host "USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"

Push-Location "$PSScriptRoot\.."

$envContent = @"
VITE_API_URL=$API_URL
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
VITE_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_COGNITO_CALLBACK=$CallbackDefault
"@
Set-Content -Path .env -Value $envContent -NoNewline
Write-Host "Wrote .env"
Get-Content .env

npm i
npm run build

aws s3 sync dist/ "s3://$SITE_BUCKET" --delete --region $Region

if (-not [string]::IsNullOrWhiteSpace($DIST_ID) -and $DIST_ID -ne "None") {
  aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" | Out-Null
  Write-Host "Invalidation created."
} else {
  Write-Host "No CloudFront Distribution ID found; skipping invalidation."
}

Write-Host "Deployed. Site should be available at: https://$CF_DOMAIN"

Pop-Location
