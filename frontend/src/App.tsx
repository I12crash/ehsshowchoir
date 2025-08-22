import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

import Header from './components/Header'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import InvoiceManagement from './pages/InvoiceManagement'
import StudentManagement from './pages/StudentManagement'
import PaymentHistory from './pages/PaymentHistory'
import Settings from './pages/Settings'

import './styles/App.css'

// Custom Authenticator components
const components = {
  Header() {
    return (
      <div className="auth-header">
        <h1>Edgewood Show Choir</h1>
        <p>Payment Portal</p>
      </div>
    );
  },
};

const formFields = {
  signIn: {
    username: {
      placeholder: 'Enter your email',
      label: 'Email *',
      inputProps: { type: 'email', autoComplete: 'email' }
    }
  },
  signUp: {
    email: {
      placeholder: 'Enter your email',
      label: 'Email *',
      inputProps: { type: 'email', autoComplete: 'email' }
    },
    given_name: {
      placeholder: 'Enter your first name',
      label: 'First Name *'
    },
    family_name: {
      placeholder: 'Enter your last name',
      label: 'Last Name *'
    }
  }
};

const App: React.FC = () => {
  return (
    <Authenticator 
      components={components}
      formFields={formFields}
      signUpAttributes={['email', 'given_name', 'family_name']}
    >
      {({ signOut, user }) => (
        <Router>
          <div className="app">
            <Header user={user} signOut={signOut} />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/invoices" element={<InvoiceManagement />} />
                <Route path="/students" element={<StudentManagement />} />
                <Route path="/payments" element={<PaymentHistory />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      )}
    </Authenticator>
  )
}

export default App
