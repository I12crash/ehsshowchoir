import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import AdminDashboard from './components/AdminDashboard';
import Dashboard from './components/Dashboard';
import Callback from './components/Callback';
import { post } from 'aws-amplify/api';
import './App.css';

function App() {
  return (
    <Router>
      <Authenticator>
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<AuthenticatedRoute />} />
        </Routes>
      </Authenticator>
    </Router>
  );
}

function AuthenticatedRoute() {
  const { user } = useAuthenticator((context) => [context.user]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const userEmail = user?.signInDetails?.loginId || user?.attributes?.email || '';
      console.log('Checking admin status for:', userEmail);
      
      const restOperation = post({
        apiName: 'FosterAPI',
        path: '/admin/check',
        options: {
          body: {
            email: userEmail,
          },
        },
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const data = JSON.parse(text);
      console.log('Admin check response:', data);
      setIsAdmin(data.isAdmin);
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
    }
  };

  if (!user || isAdmin === null) {
    return <div>Loading...</div>;
  }

  // Always route admin to admin dashboard
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  
  return <Navigate to="/dashboard" replace />;
}

export default App;
