import { useEffect, useState } from 'react'
import { getTokens, logout } from '../auth'

export default function Invoice(){
  const [data, setData] = useState<any>(null)
  const tokens = getTokens();
  const isAuthed = !!tokens?.id_token;

  useEffect(() => {
    (async () => {
      const base = import.meta.env.VITE_API_URL;
      const headers: any = {};
      let url = `${base}/me/invoice`;

      if (tokens?.id_token) {
        headers['Authorization'] = `Bearer ${tokens.id_token}`;
      } else {
        const qp = new URLSearchParams({ parentSub: 'TEST-PARENT' });
        url += `?${qp.toString()}`;
      }

      const resp = await fetch(url, { headers });
      setData(await resp.json())
    })()
  }, [isAuthed])

  return (
    <div>
      <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
        {isAuthed ? (
          <>
            <span>Signed in</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <span>Not signed in (showing sandbox data)</span>
        )}
      </div>

      {!data ? <p>Loading…</p> :
        (!data.invoices || data.invoices.length === 0 ? <p>No invoices found.</p> :
          <div>
            <h2>Your Invoice(s) — {data.season}</h2>
            {data.invoices.map((inv: any, idx: number) => (
              <div key={idx} style={{border:'1px solid #ddd', padding:'1rem', margin:'1rem 0'}}>
                <div><strong>Student:</strong> {inv.studentName || inv.studentId}</div>
                <div><strong>Season:</strong> {inv.season}</div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
