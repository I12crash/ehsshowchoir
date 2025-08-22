import React from 'react'
import ReactDOM from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import App from './App.tsx'
import './index.css'

// Configure Amplify
const amplifyConfig = {
  Auth: {
    Cognito: {
      region: import.meta.env.VITE_AWS_REGION || 'us-east-2',
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [import.meta.env.VITE_CALLBACK_URL || window.location.origin],
          redirectSignOut: [import.meta.env.VITE_CALLBACK_URL || window.location.origin],
          responseType: 'code' as const,
        },
        email: true,
      },
    },
  },
  API: {
  REST: {
    // Use a simpler API name that matches our CDK
    'ehsAPI': {
      endpoint: import.meta.env.VITE_API_URL || '',
      region: import.meta.env.VITE_AWS_REGION || 'us-east-2'
      }
    }
  }
}

Amplify.configure(amplifyConfig)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
