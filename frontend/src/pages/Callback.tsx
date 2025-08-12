import { useEffect } from 'react'
import { parseHashTokens, saveTokens } from '../auth'

export default function Callback(){
  useEffect(() => {
    const tokens = parseHashTokens(window.location.hash || '');
    if(tokens.id_token){
      saveTokens(tokens);
      window.location.replace('/');
    }else{
      window.location.replace('/');
    }
  }, []);

  return <p>Signing you in…</p>
}
