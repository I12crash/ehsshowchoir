const domain = import.meta.env.VITE_COGNITO_DOMAIN;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const redirect = encodeURIComponent(import.meta.env.VITE_COGNITO_CALLBACK);
const base = `${domain}/oauth2/authorize?client_id=${clientId}&response_type=token+id_token&scope=openid+email+profile&redirect_uri=${redirect}`;

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.5 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.1 6.1 28.8 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10 0 19-7.5 19-20 0-1.3-.1-2.5-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.7 19 14 24 14c3 0 5.8 1.1 7.9 3l5.7-5.7C33.1 6.1 28.8 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.9 13.9-5.3l-6.4-5.2C29.3 35.3 26.9 36 24 36c-5.5 0-9.9-3.4-11.6-8.1l-6.6 5.1C8.7 39.3 15.8 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.3 3.6-4.7 6-9.3 6-5.5 0-9.9-3.4-11.6-8.1l-6.6 5.1C8.7 39.3 15.8 44 24 44c10 0 19-7.5 19-20 0-1.3-.1-2.5-.4-3.5z"/>
  </svg>
);
const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="white" d="M22.675 0h-21.35C.595 0 0 .594 0 1.326v21.348C0 23.406.595 24 1.326 24H12.82v-9.294H9.692V11.01h3.127V8.413c0-3.1 1.893-4.788 4.658-4.788 1.325 0 2.463.099 2.796.143v3.24h-1.918c-1.504 0-1.795.715-1.795 1.764v2.316h3.59l-.467 3.696h-3.123V24h6.127C23.406 24 24 23.406 24 22.674V1.326C24 .594 23.406 0 22.675 0z"/>
  </svg>
);
export default function LoginButtons(){
  return (
    <div className="card">
      <h2 className="section-title" style={{marginTop:0}}>Sign in</h2>
      <p>Use your email/password, Google, or Facebook account to view your student's invoice.</p>
      <div className="login-buttons">
        <a className="sso" href={`${base}&identity_provider=COGNITO`}>
          <span className="brand-mark" style={{width:24,height:24,borderRadius:6}}>E</span>
          <span>Email / Password</span>
        </a>
        <a className="sso google" href={`${base}&identity_provider=Google`}>
          <GoogleLogo />
          <span>Continue with Google</span>
        </a>
        <a className="sso facebook" href={`${base}&identity_provider=Facebook`}>
          <FacebookLogo />
          <span>Continue with Facebook</span>
        </a>
      </div>
    </div>
  )
}
