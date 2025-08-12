Param(
  [string]$Region = "us-east-2",
  [string]$Stack = "ShowChoirBillingStack",
  [string]$Callback = "http://localhost:5173/callback"
)

$API_URL = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text --region $Region
$DOMAIN = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='HostedUIDomain'].OutputValue" --output text --region $Region
$CLIENT = aws cloudformation describe-stacks --stack-name $Stack --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text --region $Region

$envContent = @"
VITE_API_URL=$API_URL
VITE_COGNITO_DOMAIN=$DOMAIN
VITE_COGNITO_CLIENT_ID=$CLIENT
VITE_COGNITO_CALLBACK=$Callback
"@

Set-Content -Path ../.env -Value $envContent -NoNewline
Write-Host "Wrote ../.env"
Get-Content ../.env
