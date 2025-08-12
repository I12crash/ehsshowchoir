const domain = import.meta.env.VITE_COGNITO_DOMAIN;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const redirect = encodeURIComponent(import.meta.env.VITE_COGNITO_CALLBACK);
const base = `${domain}/oauth2/authorize?client_id=${clientId}&response_type=code&scope=openid+email+profile&redirect_uri=${redirect}`;

export default function LoginButtons(){
  return (
    <div style={{display:'flex', gap:'0.5rem', margin:'1rem 0'}}>
      <a href={`${base}&identity_provider=COGNITO`}>Email / Password</a>
      <a href={`${base}&identity_provider=Google`}>Google</a>
      <a href={`${base}&identity_provider=Facebook`}>Facebook</a>
    </div>
  )
}
