import React from 'react'
import { createRoot } from 'react-dom/client'
import Invoice from './pages/Invoice'
import LoginButtons from './components/LoginButtons'

function App(){
  return (
    <div style={{maxWidth: 800, margin: '2rem auto', fontFamily: 'system-ui, sans-serif'}}>
      <h1>Show Choir Billing (Test)</h1>
      <LoginButtons />
      <Invoice />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
