import React, { useState, useEffect } from 'react'
import { get } from 'aws-amplify/api'
import { 
  Users, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  Activity,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface DashboardStats {
  totalStudents: number
  activeInvoices: number
  totalRevenue: number
  recentPayments: number
  pendingPayments?: number
  monthlyGrowth?: number
}

interface RecentActivity {
  id: string
  type: 'payment' | 'invoice' | 'student'
  description: string
  timestamp: string
  amount?: number
  status?: 'success' | 'pending' | 'warning'
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeInvoices: 0,
    totalRevenue: 0,
    recentPayments: 0,
    pendingPayments: 0,
    monthlyGrowth: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load students to calculate stats
      const studentsResponse = await get({
        apiName: 'ehsshowchoirApi',
        path: '/students'
      }).response
      
      const students = await studentsResponse.body.json()
      
      // Calculate basic stats
      const totalStudents = students?.length || 0
      
      // Mock additional stats for now
      const mockStats = {
        totalStudents,
        activeInvoices: Math.floor(totalStudents * 0.3),
        totalRevenue: 45250.75,
        recentPayments: 8,
        pendingPayments: Math.floor(totalStudents * 0.2),
        monthlyGrowth: 12.5
      }
      
      setStats(mockStats)

      // Mock recent activity
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'payment',
          description: 'Payment received from Sarah Johnson',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          amount: 150.00,
          status: 'success'
        },
        {
          id: '2',
          type: 'invoice',
          description: 'Bulk invoices sent to 25 parents',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          status: 'success'
        },
        {
          id: '3',
          type: 'student',
          description: 'New student added: Mike Chen',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          status: 'success'
        },
        {
          id: '4',
          type: 'payment',
          description: 'Payment reminder sent to 5 parents',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          status: 'pending'
        }
      ]
      
      setRecentActivity(mockActivity)
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="container">
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="container">
          <div className="error-message">
            <AlertCircle size={48} />
            <h2>Unable to load dashboard</h2>
            <p>{error}</p>
            <button onClick={loadDashboardData} className="btn btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back! Here's an overview of your show choir payment system.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">
              <Users size={32} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.totalStudents}</h3>
              <p className="stat-label">Total Students</p>
              <span className="stat-change positive">+3 this month</span>
            </div>
          </div>

          <div className="stat-card secondary">
            <div className="stat-icon">
              <FileText size={32} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.activeInvoices}</h3>
              <p className="stat-label">Active Invoices</p>
              <span className="stat-change neutral">{stats.pendingPayments} pending</span>
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-icon">
              <DollarSign size={32} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{formatCurrency(stats.totalRevenue)}</h3>
              <p className="stat-label">Total Revenue</p>
              <span className="stat-change positive">+{stats.monthlyGrowth}% this month</span>
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-icon">
              <TrendingUp size={32} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.recentPayments}</h3>
              <p className="stat-label">Recent Payments</p>
              <span className="stat-change positive">Last 7 days</span>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Quick Actions */}
          <div className="card-component">
            <h2 className="section-title">Quick Actions</h2>
            <div className="quick-actions">
              <a href="/invoices" className="action-card">
                <FileText size={24} />
                <h3>Send Bulk Invoices</h3>
                <p>Send monthly invoices to all parents</p>
              </a>
              
              <a href="/students" className="action-card">
                <Users size={24} />
                <h3>Manage Students</h3>
                <p>Add, edit, or remove student records</p>
              </a>
              
              <a href="/payments" className="action-card">
                <DollarSign size={24} />
                <h3>View Payments</h3>
                <p>Track payment history and status</p>
              </a>
              
              <a href="/settings" className="action-card">
                <Activity size={24} />
                <h3>System Settings</h3>
                <p>Configure system preferences</p>
              </a>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card-component">
            <div className="card-header">
              <h2 className="section-title">Recent Activity</h2>
              <Clock size={20} />
            </div>
            
            <div className="activity-list">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-icon">
                      {activity.status === 'success' && <CheckCircle size={16} className="text-success" />}
                      {activity.status === 'pending' && <Clock size={16} className="text-warning" />}
                      {activity.status === 'warning' && <AlertCircle size={16} className="text-danger" />}
                    </div>
                    <div className="activity-content">
                      <p className="activity-description">{activity.description}</p>
                      <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                    {activity.amount && (
                      <div className="activity-amount">
                        {formatCurrency(activity.amount)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Activity size={48} />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
            
            <div className="card-footer">
              <a href="/payments" className="btn btn-outline btn-small">
                View All Activity
              </a>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="summary-card">
            <h3>This Month</h3>
            <div className="summary-stats">
              <div className="summary-stat">
                <span className="summary-number">12</span>
                <span className="summary-label">New Payments</span>
              </div>
              <div className="summary-stat">
                <span className="summary-number">{formatCurrency(3240)}</span>
                <span className="summary-label">Revenue</span>
              </div>
            </div>
          </div>
          
          <div className="summary-card">
            <h3>Outstanding</h3>
            <div className="summary-stats">
              <div className="summary-stat">
                <span className="summary-number">{stats.pendingPayments}</span>
                <span className="summary-label">Pending Payments</span>
              </div>
              <div className="summary-stat">
                <span className="summary-number">{formatCurrency(1850)}</span>
                <span className="summary-label">Amount Due</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
