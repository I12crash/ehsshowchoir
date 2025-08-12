import { useEffect, useState } from 'react'

export default function Invoice(){
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    (async () => {
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/me/invoice?parentSub=TEST-PARENT`)
      setData(await resp.json())
    })()
  }, [])

  if(!data) return <p>Loading…</p>
  if(!data.invoices || data.invoices.length === 0) return <p>No invoices found.</p>

  return (
    <div>
      <h2>Your Invoice(s) — {data.season}</h2>
      {data.invoices.map((inv: any, idx: number) => (
        <div key={idx} style={{border:'1px solid #ddd', padding:'1rem', margin:'1rem 0'}}>
          <div><strong>Student:</strong> {inv.studentName || inv.studentId}</div>
          <div><strong>Season:</strong> {inv.season}</div>
          <div style={{marginTop:'.5rem'}}>
            <strong>Items:</strong>
            <ul>
              <li>In this starter, items are flattened; see DynamoDB rows with PK=STUDENT#ID, SK=INVOICE#SEASON</li>
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}
