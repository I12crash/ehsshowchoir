import { Amplify } from 'aws-amplify';

const config = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [import.meta.env.VITE_CALLBACK_URL],
          redirectSignOut: [import.meta.env.VITE_CALLBACK_URL?.replace('/callback', '')],
          responseType: 'code' as const,
        },
      },
    },
  },
  API: {
    REST: {
      FosterAPI: {
        endpoint: import.meta.env.VITE_API_URL,
      },
    },
  },
};

Amplify.configure(config);
