import { useState } from 'react'
import { getTokens } from '../auth'

const API = import.meta.env.VITE_API_URL
const tokens = getTokens()
const headers: any = { 'Content-Type': 'application/json' }
if(tokens?.id_token){ headers['Authorization'] = `Bearer ${tokens.id_token}` }

function Panel({title, children}:{title:string, children:any}){
  return <section className="card">
    <h3 className="section-title" style={{marginTop:0}}>{title}</h3>
    {children}
  </section>
}

export default function AdminManage(){
  // Add/Update Student
  const [student, setStudent] = useState({ choir:'MW', castNumber:'', studentName:'', gender:'', grade:'' })
  const saveStudent = async () => {
    const body = { ...student, castNumber: Number(student.castNumber)||student.castNumber, grade: Number(student.grade)||undefined }
    const resp = await fetch(`${API}/admin/students`, { method:'POST', headers, body: JSON.stringify(body) })
    alert(resp.ok ? 'Saved!' : await resp.text())
  }

  // Remove Student
  const [delId, setDelId] = useState('')
  const removeStudent = async () => {
    if(!delId) return alert('Enter student_id like MW-CAST101')
    const resp = await fetch(`${API}/admin/students/${encodeURIComponent(delId)}`, { method:'DELETE', headers })
    alert(resp.ok ? 'Removed (soft delete).' : await resp.text())
  }

  // Single Transaction
  const [txn, setTxn] = useState({ studentId:'', type:'fee', amount:'', season:'', category:'Dues', description:'', date:'' })
  const saveTxn = async () => {
    const body = { ...txn, amount: Number(txn.amount) }
    const resp = await fetch(`${API}/admin/transaction`, { method:'POST', headers, body: JSON.stringify(body) })
    alert(resp.ok ? 'Transaction added!' : await resp.text())
  }

  // Batch Charge
  const [batch, setBatch] = useState({ choir:'MW', gender:'ALL', amount:'', season:'', category:'Dues', description:'', date:'' })
  const runBatch = async () => {
    const body = { ...batch, amount: Number(batch.amount) }
    const resp = await fetch(`${API}/admin/batch/charge`, { method:'POST', headers, body: JSON.stringify(body) })
    const t = await resp.text()
    try { const j = JSON.parse(t); alert(resp.ok ? `Batch OK: ${j.count} students` : t) } catch { alert(t)}
  }

  // Parent link
  const [plink, setPlink] = useState({ parentEmail:'', studentId:'' })
  const savePlink = async () => {
    const resp = await fetch(`${API}/admin/parent-link`, { method:'POST', headers, body: JSON.stringify(plink) })
    alert(resp.ok ? 'Linked!' : await resp.text())
  }

  return <div className="panels">
    <Panel title="Add / Update Student">
      <div className="grid grid-6">
        <label>Choir
          <select value={student.choir} onChange={e=>setStudent(s=>({...s, choir:e.target.value}))}>
            <option>MW</option><option>SL</option><option>VO</option>
          </select>
        </label>
        <label>Cast #
          <input value={student.castNumber} onChange={e=>setStudent(s=>({...s, castNumber:e.target.value}))} placeholder="e.g., 101" />
        </label>
        <label>Name
          <input value={student.studentName} onChange={e=>setStudent(s=>({...s, studentName:e.target.value}))} />
        </label>
        <label>Gender
          <select value={student.gender} onChange={e=>setStudent(s=>({...s, gender:e.target.value}))}>
            <option value="">—</option><option value="M">Male</option><option value="F">Female</option>
          </select>
        </label>
        <label>Grade
          <select value={student.grade} onChange={e=>setStudent(s=>({...s, grade:e.target.value}))}>
            <option value="">—</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option>
          </select>
        </label>
        <div><button className="btn" onClick={saveStudent}>Save</button></div>
      </div>
    </Panel>

    <Panel title="Remove Student (soft delete)">
      <div className="grid grid-3">
        <label>Student ID
          <input value={delId} onChange={e=>setDelId(e.target.value)} placeholder="MW-CAST101" />
        </label>
        <div></div>
        <div><button className="btn btn-outline" onClick={removeStudent}>Remove</button></div>
      </div>
    </Panel>

    <Panel title="Add Single Transaction">
      <div className="grid grid-6">
        <label>Student ID
          <input value={txn.studentId} onChange={e=>setTxn(s=>({...s, studentId:e.target.value}))} placeholder="MW-CAST101" />
        </label>
        <label>Type
          <select value={txn.type} onChange={e=>setTxn(s=>({...s, type:e.target.value}))}>
            <option value="fee">Fee</option><option value="credit">Credit</option>
          </select>
        </label>
        <label>Amount ($)
          <input value={txn.amount} onChange={e=>setTxn(s=>({...s, amount:e.target.value}))} placeholder="25.00" />
        </label>
        <label>Season
          <input value={txn.season} onChange={e=>setTxn(s=>({...s, season:e.target.value}))} placeholder="2025-2026" />
        </label>
        <label>Category
          <input value={txn.category} onChange={e=>setTxn(s=>({...s, category:e.target.value}))} placeholder="Dues" />
        </label>
        <label>Date
          <input value={txn.date} onChange={e=>setTxn(s=>({...s, date:e.target.value}))} placeholder="YYYY-MM-DD" />
        </label>
        <div style={{gridColumn:'1 / -1'}}>
          <label>Description
            <input value={txn.description} onChange={e=>setTxn(s=>({...s, description:e.target.value}))} />
          </label>
        </div>
        <div><button className="btn" onClick={saveTxn}>Add Transaction</button></div>
      </div>
    </Panel>

    <Panel title="Batch Charge (Choir-wide; MW supports Male/Female)">
      <div className="grid grid-6">
        <label>Choir
          <select value={batch.choir} onChange={e=>setBatch(s=>({...s, choir:e.target.value}))}>
            <option>MW</option><option>SL</option><option>VO</option>
          </select>
        </label>
        <label>Gender
          <select value={batch.gender} onChange={e=>setBatch(s=>({...s, gender:e.target.value}))}>
            <option>ALL</option><option>M</option><option>F</option>
          </select>
        </label>
        <label>Amount ($)
          <input value={batch.amount} onChange={e=>setBatch(s=>({...s, amount:e.target.value}))} placeholder="25.00" />
        </label>
        <label>Season
          <input value={batch.season} onChange={e=>setBatch(s=>({...s, season:e.target.value}))} placeholder="2025-2026" />
        </label>
        <label>Category
          <input value={batch.category} onChange={e=>setBatch(s=>({...s, category:e.target.value}))} placeholder="Dues" />
        </label>
        <label>Date
          <input value={batch.date} onChange={e=>setBatch(s=>({...s, date:e.target.value}))} placeholder="YYYY-MM-DD" />
        </label>
        <div style={{gridColumn:'1 / -1'}}>
          <label>Description
            <input value={batch.description} onChange={e=>setBatch(s=>({...s, description:e.target.value}))} placeholder="e.g., Season dues MW Males" />
          </label>
        </div>
        <div><button className="btn" onClick={runBatch}>Apply Charge</button></div>
      </div>
    </Panel>

    <Panel title="Parent ↔ Student Link">
      <div className="grid grid-6">
        <label>Parent Email
          <input value={plink.parentEmail} onChange={e=>setPlink(s=>({...s, parentEmail:e.target.value}))} placeholder="parent@example.com" />
        </label>
        <label>Student ID
          <input value={plink.studentId} onChange={e=>setPlink(s=>({...s, studentId:e.target.value}))} placeholder="MW-CAST101" />
        </label>
        <div><button className="btn" onClick={savePlink}>Link</button></div>
      </div>
    </Panel>
  </div>
}
