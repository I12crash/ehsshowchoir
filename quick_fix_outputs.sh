#!/bin/bash

echo "🔧 Fixing TypeScript unused variable warnings"
echo "============================================"

cd frontend

# Fix Navigation.tsx - Remove unused React import
echo "📝 Fixing Navigation.tsx..."
sed -i.backup 's/import React from '\''react'\''//' src/components/Navigation.tsx

# Fix InvoiceManagement.tsx - Remove unused variables and React import
echo "📝 Fixing InvoiceManagement.tsx..."
sed -i.backup 's/import React, { /import { /' src/pages/InvoiceManagement.tsx
sed -i.backup '/const \[invoiceData, setInvoiceData\]/d' src/pages/InvoiceManagement.tsx

# Fix PaymentHistory.tsx - Remove unused React import  
echo "�� Fixing PaymentHistory.tsx..."
sed -i.backup 's/import React, { /import { /' src/pages/PaymentHistory.tsx

# Clean up backup files
rm -f src/components/Navigation.tsx.backup
rm -f src/pages/InvoiceManagement.tsx.backup
rm -f src/pages/PaymentHistory.tsx.backup

echo "✅ Unused variable warnings fixed!"
echo ""
echo "🚀 Now try building again:"
echo "npm run build"
