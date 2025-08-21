import { useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import StudentManager from './StudentManager';
import TransactionManager from './TransactionManager';
import ParentManager from './ParentManager';
import InvoiceManager from './InvoiceManager';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [activeTab, setActiveTab] = useState('students');
  
  const userEmail = user?.signInDetails?.loginId || user?.attributes?.email || '';
  const isAdmin = userEmail.toLowerCase() === 'showchoirtreasurer@gmail.com';

  if (!isAdmin) {
    return (
      <div className="not-admin">
        <h2>Access Denied</h2>
        <p>This page is restricted to administrators only.</p>
        <p>Current user: {userEmail}</p>
        <button onClick={signOut}>Sign Out</button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Show Choir Billing System</h1>
        <div className="header-right">
          <span>Admin: {userEmail}</span>
          <button onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <nav className="admin-nav">
        <button 
          className={activeTab === 'students' ? 'active' : ''}
          onClick={() => setActiveTab('students')}
        >
          Students
        </button>
        <button 
          className={activeTab === 'transactions' ? 'active' : ''}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button 
          className={activeTab === 'parents' ? 'active' : ''}
          onClick={() => setActiveTab('parents')}
        >
          Parents
        </button>
        <button 
          className={activeTab === 'invoices' ? 'active' : ''}
          onClick={() => setActiveTab('invoices')}
        >
          Invoices
        </button>
      </nav>

      <main className="admin-content">
        {activeTab === 'students' && <StudentManager />}
        {activeTab === 'transactions' && <TransactionManager />}
        {activeTab === 'parents' && <ParentManager />}
        {activeTab === 'invoices' && <InvoiceManager />}
      </main>
    </div>
  );
}
