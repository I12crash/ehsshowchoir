export function parseHash() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const params = new URLSearchParams(hash)
  const access_token = params.get('access_token') || ''
  const id_token = params.get('id_token') || ''
  const expires_in = params.get('expires_in') || ''
  return { access_token, id_token, expires_in }
}
export function getTokens(){
  const raw = localStorage.getItem('tokens')
  if(!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}
export function saveTokens(tok:any){
  localStorage.setItem('tokens', JSON.stringify(tok))
}
export function getEmailFromToken(){
  const tok = getTokens()
  if(!tok?.id_token) return null
  // decode JWT payload
  const payload = JSON.parse(atob(tok.id_token.split('.')[1]))
  return payload.email || null
}
