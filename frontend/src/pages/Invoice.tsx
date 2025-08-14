import { useEffect, useState } from 'react'
import { getEmailFromToken } from '../auth'

export default function Invoice(){
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const email = getEmailFromToken()

  useEffect(() => {
    const run = async () => {
      const base = import.meta.env.VITE_API_URL
      const url = email ? `${base}/me/invoice?parentEmail=${encodeURIComponent(email)}` : ''
      if(!url){ setLoading(false); return }
      const resp = await fetch(url)
      const j = await resp.json()
      setData(j)
      setLoading(false)
    }
    run()
  }, [email])

  if(!email) return <div className="card"><p>Please sign in to view your student's invoices.</p></div>
  if(loading) return <div className="card"><p>Loading…</p></div>
  if(!data?.invoices?.length) return <div className="card"><p>No invoices found for {email}.</p></div>

  return <div className="card">
    {data.invoices.map((inv:any) => (
      <div key={inv.studentId} style={{marginBottom:'1rem'}}>
        <h3 style={{margin:'0 0 .5rem'}}>Invoice — {inv.profile?.studentName || inv.studentId} <small>({inv.studentId})</small></h3>
        <p><strong>Fees:</strong> ${(inv.totals.feeCents/100).toFixed(2)} &nbsp; <strong>Credits:</strong> ${(inv.totals.creditCents/100).toFixed(2)} &nbsp; <strong>Balance:</strong> ${(inv.totals.balanceCents/100).toFixed(2)}</p>
        <table className="table">
          <thead><tr><th>Date</th><th>Type</th><th>Season</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            {inv.txns.map((t:any) => (
              <tr key={t.SK}>
                <td>{t.date}</td>
                <td>{t.type}</td>
                <td>{t.season}</td>
                <td>{t.category}</td>
                <td>{t.description}</td>
                <td>${(t.amountCents/100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}
  </div>
}
