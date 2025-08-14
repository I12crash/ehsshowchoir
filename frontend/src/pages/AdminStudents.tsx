import { useEffect, useState } from 'react'
import { getTokens } from '../auth'

type Student = { studentId: string; studentName?: string; choir?: string; gender?: string; grade?: number; active?: boolean }

export default function AdminStudents(){
  const [rows, setRows] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const tokens = getTokens()
  const headers: any = {}
  if(tokens?.id_token){ headers['Authorization'] = `Bearer ${tokens.id_token}` }

  const reload = async () => {
    const base = import.meta.env.VITE_API_URL
    const resp = await fetch(`${base}/admin/students`, { headers })
    const data = await resp.json()
    setRows(data.students || [])
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  const downloadCsv = async () => {
    const base = import.meta.env.VITE_API_URL
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

  const saveRow = async (i: number) => {
    const r = rows[i]
    const base = import.meta.env.VITE_API_URL
    const body: any = { studentId: r.studentId }
    if (r.gender !== undefined) body.gender = r.gender
    if (r.grade !== undefined && r.grade !== null) body.grade = Number(r.grade)
    const resp = await fetch(`${base}/admin/students`, { method:'POST', headers: { ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(body) })
    if (!resp.ok) alert(await resp.text()); else alert('Saved')
  }

  const setValue = (i: number, key: keyof Student, value: any) => {
    setRows(rs => {
      const copy = [...rs]
      copy[i] = { ...copy[i], [key]: value }
      return copy
    })
  }

  if(loading) return <p>Loading…</p>

  return (
    <div className="card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.5rem'}}>
        <strong>{rows.length} students</strong>
        <div style={{display:'flex', gap:'.5rem'}}>
          <button className="btn btn-outline" onClick={downloadCsv}>Download CSV</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Student</th>
            <th>ID</th>
            <th>Choir</th>
            <th>Gender</th>
            <th>Grade</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.studentId}>
              <td>{r.studentName || '—'}</td>
              <td>{r.studentId}</td>
              <td>{r.choir || '—'}</td>
              <td>
                <select value={r.gender || ''} onChange={e=>setValue(i,'gender', e.target.value)}>
                  <option value="">—</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </td>
              <td>
                <select value={r.grade ?? ''} onChange={e=>setValue(i,'grade', e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">—</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                  <option value="12">12</option>
                </select>
              </td>
              <td>{r.active === false ? 'No' : 'Yes'}</td>
              <td><button className="btn btn-subtle" onClick={()=>saveRow(i)}>Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
