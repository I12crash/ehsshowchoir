#!/usr/bin/env bash
set -euo pipefail

: "${REGION:=us-east-2}"

pushd cdk >/dev/null
npm i
npm run build
npx cdk deploy --require-approval never
popd >/dev/null
