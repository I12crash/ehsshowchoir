import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { getCurrentUser, type AuthUser } from 'aws-amplify/auth'
import { signOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import Header from './components/Header'
import Navigation from './components/Navigation'
import Dashboard from './pages/Dashboard'
import StudentManagement from './pages/StudentManagement'
import PaymentHistory from './pages/PaymentHistory'
import InvoiceManagement from './pages/InvoiceManagement'
import Login from './pages/Login'
import './App.css'

function App() {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    checkUser()

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkUser()
          break
        case 'signedOut':
          setUser(null)
          break
      }
    })

    return unsubscribe
  }, [])

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header user={user} signOut={handleSignOut} />
        <div className="flex">
          <Navigation />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/students" element={<StudentManagement />} />
              <Route path="/payments" element={<PaymentHistory />} />
              <Route path="/invoices" element={<InvoiceManagement />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App
