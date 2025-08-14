import React from 'react'
import { createRoot } from 'react-dom/client'
import Invoice from './pages/Invoice'
import LoginButtons from './components/LoginButtons'
import Callback from './pages/Callback'
import AdminStudents from './pages/AdminStudents'
import AdminManage from './pages/AdminManage'
import './styles.css'

function Hero(){
  return (
    <div className="hero">
      <div className="hero-inner">
        <h1 className="hero-title">Edgewood Choirs — Billing Portal</h1>
        <p className="hero-sub">Securely view invoices, make payments, and manage student accounts for Music Warehouse, Sophisticated Ladies, and Vocal Odyssey.</p>
        <div className="hero-actions">
          <a className="btn" href="#start">Get Started</a>
          <a className="btn btn-subtle" href="/admin/students">Admin: Students</a>
        </div>
      </div>
    </div>
  )
}

function Shell({children}:{children:any}){
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="wrap nav-row">
          <a className="brand" href="/">
            <span className="brand-mark">E</span>
            <span className="brand-title">Edgewood Choirs • Billing</span>
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/admin/students">Admin</a>
            <a href="/admin/manage">Manage</a>
          </nav>
        </div>
      </header>
      <Hero />
      <main className="page" id="start">{children}</main>
      <footer className="footer">© Edgewood Choirs — Billing Portal</footer>
    </div>
  )
}

function App(){
  const path = window.location.pathname
  if (path === '/callback') return <Callback />
  if (path === '/admin/students') return <Shell><h2 className="section-title">Students</h2><AdminStudents /></Shell>
  if (path === '/admin/manage') return <Shell><h2 className="section-title">Administration</h2><AdminManage /></Shell>
  return (
    <Shell>
      <h2 className="section-title">Sign In</h2>
      <LoginButtons />
      <h2 className="section-title">Your Invoices</h2>
      <Invoice />
    </Shell>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
