import { useEffect, useState } from 'react'
import { getTokens } from '../auth'

type Student = { studentId: string; studentName?: string; choir?: string }

export default function AdminStudents(){
  const [rows, setRows] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const tokens = getTokens()

  useEffect(() => {
    (async () => {
      const base = import.meta.env.VITE_API_URL
      const headers: any = {}
      if(tokens?.id_token){ headers['Authorization'] = `Bearer ${tokens.id_token}` }
      const resp = await fetch(`${base}/admin/students`, { headers })
      const data = await resp.json()
      setRows(data.students || [])
      setLoading(false)
    })()
  }, [])

  const downloadCsv = async () => {
    const base = import.meta.env.VITE_API_URL
    const headers: any = {}
    if(tokens?.id_token){ headers['Authorization'] = `Bearer ${tokens.id_token}` }
    const resp = await fetch(`${base}/admin/students?format=csv`, { headers })
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if(loading) return <p>Loading…</p>

  return (
    <div>
      <h2>Admin · Students</h2>
      <button onClick={downloadCsv}>Download CSV</button>
      <table style={{width:'100%', marginTop:'1rem', borderCollapse:'collapse'}}>
        <thead>
          <tr>
            <th style={{textAlign:'left', borderBottom:'1px solid #ddd'}}>Student</th>
            <th style={{textAlign:'left', borderBottom:'1px solid #ddd'}}>Student ID</th>
            <th style={{textAlign:'left', borderBottom:'1px solid #ddd'}}>Choir</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{borderBottom:'1px solid #f0f0f0'}}>{r.studentName || '—'}</td>
              <td style={{borderBottom:'1px solid #f0f0f0'}}>{r.studentId}</td>
              <td style={{borderBottom:'1px solid #f0f0f0'}}>{r.choir || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
