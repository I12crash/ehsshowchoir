export type Tokens = { id_token?: string; access_token?: string; expires_at?: number };

const KEY = 'auth_tokens';

export function saveTokens(t: Tokens){
  localStorage.setItem(KEY, JSON.stringify(t));
}
export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    const t = JSON.parse(raw) as Tokens;
    if(t.expires_at && Date.now() > t.expires_at) { localStorage.removeItem(KEY); return null; }
    return t;
  } catch { return null; }
}
export function clearTokens(){ localStorage.removeItem(KEY); }

export function parseHashTokens(hash: string): Tokens {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const id = params.get('id_token') || undefined;
  const acc = params.get('access_token') || undefined;
  const expiresIn = params.get('expires_in');
  const expires_at = expiresIn ? (Date.now() + Number(expiresIn) * 1000 - 5000) : undefined;
  return { id_token: id, access_token: acc, expires_at };
}

export function logout(){
  clearTokens();
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const redirect = encodeURIComponent(import.meta.env.VITE_COGNITO_CALLBACK);
  window.location.href = `${domain}/logout?client_id=${import.meta.env.VITE_COGNITO_CLIENT_ID}&logout_uri=${redirect}`;
}
