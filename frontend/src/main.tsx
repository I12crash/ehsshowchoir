import React from 'react'
import { createRoot } from 'react-dom/client'
import Invoice from './pages/Invoice'
import LoginButtons from '../src/components/LoginButtons'
import Callback from './pages/Callback'
import AdminStudents from './pages/AdminStudents'

function App(){
  const path = window.location.pathname
  if (path === '/callback') return <Callback />
  if (path === '/admin/students') return <AdminStudents />
  return (
    <div style={{maxWidth: 1000, margin: '2rem auto', fontFamily: 'system-ui, sans-serif'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
        <h1>Show Choir Billing (Test)</h1>
        <nav style={{display:'flex', gap:'1rem'}}>
          <a href="/">Home</a>
          <a href="/admin/students">Admin: Students</a>
        </nav>
      </header>
      <LoginButtons />
      <Invoice />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
