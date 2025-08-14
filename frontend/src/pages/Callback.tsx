import { useEffect } from 'react'
import { parseHash, saveTokens } from '../auth'

export default function Callback(){
  useEffect(() => {
    const tok = parseHash()
    if(tok.id_token){
      saveTokens(tok)
      window.location.replace('/')
    } else {
      window.location.replace('/')
    }
  }, [])
  return <p>Signing in…</p>
}
