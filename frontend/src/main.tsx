import React from 'react'
import ReactDOM from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import App from './App.tsx'
import './styles/index.css'

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
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [import.meta.env.VITE_CALLBACK_URL || window.location.origin],
          redirectSignOut: [import.meta.env.VITE_CALLBACK_URL || window.location.origin],
          responseType: 'code'
        },
        email: true
      }
    }
  },
  API: {
    REST: {
      ehsshowchoirApi: {
        endpoint: import.meta.env.VITE_API_URL || '',
        region: import.meta.env.VITE_AWS_REGION || 'us-east-2'
      }
    }
  }
}

// Only configure Amplify if we have the required config
if (amplifyConfig.Auth.Cognito.userPoolId && amplifyConfig.API.REST.ehsshowchoirApi.endpoint) {
  try {
    Amplify.configure(amplifyConfig)
    console.log('Amplify configured successfully')
  } catch (error) {
    console.error('Error configuring Amplify:', error)
  }
} else {
  console.warn('Amplify configuration incomplete. Some features may not work.')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
