import React, { useState, useEffect } from 'react'
import { get } from 'aws-amplify/api'
import { 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'

interface PaymentRecord {
  id: string
  student_id: string
  studentName: string
  amount: number
  description: string
  type: string
  status: string
  transaction_date: string
  parent_email?: string
}

const PaymentHistory: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [filteredPayments, setFilteredPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })

  useEffect(() => {
    loadPaymentHistory()
  }, [])

  useEffect(() => {
    filterPayments()
  }, [payments, searchTerm, filterType, filterStatus, dateRange])

  const loadPaymentHistory = async () => {
    try {
      // Load payments
      const paymentsResponse = await get({
        apiName: 'ehsshowchoirApi',
        path: '/payment-history'
      }).response
      
      const paymentsData = await paymentsResponse.body.json()
      
      // Load students to get names
      const studentsResponse = await get({
        apiName: 'ehsshowchoirApi',
        path: '/students'
      }).response
      
      const studentsData = await studentsResponse.body.json()
      
      // Create a map of student IDs to names
      const studentMap = studentsData.reduce((acc: any, student: any) => {
        acc[student.id] = student.name
        return acc
      }, {})
      
      // Enhance payment records with student names
      const enhancedPayments = paymentsData.map((payment: any) => ({
        ...payment,
        studentName: studentMap[payment.student_id] || 'Unknown Student'
      }))
      
      setPayments(enhancedPayments || [])
    } catch (error) {
      console.error('Error loading payment history:', error)
      // Use mock data for demo
      const mockPayments: PaymentRecord[] = [
        {
          id: '1',
          student_id: 'student_1',
          studentName: 'Sarah Johnson',
          amount: 150.00,
          description: 'Monthly Tuition - March 2024',
          type: 'tuition',
          status: 'completed',
          transaction_date: '2024-03-15T10:00:00Z',
          parent_email: 'parent1@example.com'
        },
        {
          id: '2',
          student_id: 'student_2',
          studentName: 'Mike Chen',
          amount: 75.00,
          description: 'Uniform Cleaning Fee',
          type: 'uniform',
          status: 'completed',
          transaction_date: '2024-03-14T14:30:00Z',
          parent_email: 'parent2@example.com'
        },
        {
          id: '3',
          student_id: 'student_1',
          studentName: 'Sarah Johnson',
          amount: 200.00,
          description: 'Competition Trip Fee',
          type: 'trip',
          status: 'pending',
          transaction_date: '2024-03-13T09:15:00Z',
          parent_email: 'parent1@example.com'
        },
        {
          id: '4',
          student_id: 'student_3',
          studentName: 'Emma Davis',
          amount: 125.00,
          description: 'Fundraising Contribution',
          type: 'fundraising',
          status: 'completed',
          transaction_date: '2024-03-12T16:45:00Z',
          parent_email: 'parent3@example.com'
        }
      ]
      setPayments(mockPayments)
    } finally {
      setIsLoading(false)
    }
  }

  const filterPayments = () => {
    let filtered = payments

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(payment => 
        payment.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.parent_email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(payment => payment.type === filterType)
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(payment => payment.status === filterStatus)
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(payment => 
        new Date(payment.transaction_date) >= new Date(dateRange.start)
      )
    }
    if (dateRange.end) {
      filtered = filtered.filter(payment => 
        new Date(payment.transaction_date) <= new Date(dateRange.end)
      )
    }

    setFilteredPayments(filtered)
  }

  const getTotalAmount = () => {
    return filteredPayments.reduce((sum, payment) => sum + payment.amount, 0)
  }

  const getCompletedAmount = () => {
    return filteredPayments
      .filter(payment => payment.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0)
  }

  const getPendingAmount = () => {
    return filteredPayments
      .filter(payment => payment.status === 'pending')
      .reduce((sum, payment) => sum + payment.amount, 0)
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Student', 'Description', 'Type', 'Amount', 'Status']
    const csvData = filteredPayments.map(payment => [
      new Date(payment.transaction_date).toLocaleDateString(),
      payment.studentName,
      payment.description,
      payment.type,
      payment.amount.toFixed(2),
      payment.status
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} />
      case 'pending':
        return <Clock size={16} />
      case 'failed':
      case 'refunded':
        return <AlertCircle size={16} />
      default:
        return <FileText size={16} />
    }
  }

  if (isLoading) {
    return (
      <div className="payment-history">
        <div className="container">
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading payment history...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-history">
      <div className="container">
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">
              <DollarSign size={32} />
              Payment History
            </h1>
            <p className="page-subtitle">Complete record of all student payments and transactions</p>
          </div>
          <button onClick={exportToCSV} className="btn btn-secondary">
            <Download size={20} />
            Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{filteredPayments.length}</h3>
              <p className="stat-label">Total Records</p>
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-icon">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{formatCurrency(getTotalAmount())}</h3>
              <p className="stat-label">Total Amount</p>
            </div>
          </div>

          <div className="stat-card completed">
            <div className="stat-icon">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{formatCurrency(getCompletedAmount())}</h3>
              <p className="stat-label">Completed</p>
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{formatCurrency(getPendingAmount())}</h3>
              <p className="stat-label">Pending</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card-component">
          <div className="filters-section">
            <div className="search-group">
              <div className="search-input">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div className="filter-group">
              <Filter size={16} />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="form-control"
              >
                <option value="all">All Types</option>
                <option value="tuition">Tuition</option>
                <option value="uniform">Uniform</option>
                <option value="trip">Trip</option>
                <option value="fundraising">Fundraising</option>
              </select>
            </div>

            <div className="filter-group">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-control"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="date-range-group">
              <Calendar size={16} />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="form-control"
                placeholder="Start date"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="form-control"
                placeholder="End date"
              />
            </div>

            <div className="filter-results">
              <span className="results-count">
                {filteredPayments.length} of {payments.length} payments
              </span>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="card-component">
          <h2 className="section-title">Payment Records</h2>
          
          {filteredPayments.length === 0 ? (
            <div className="empty-state">
              <DollarSign size={48} />
              <h3>No payments found</h3>
              <p>
                {payments.length === 0 
                  ? 'No payment records available yet.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
            </div>
          ) : (
            <div className="payments-table-container">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(payment => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.transaction_date)}</td>
                      <td>
                        <div className="student-info">
                          <strong>{payment.studentName}</strong>
                          {payment.parent_email && (
                            <small className="parent-email">{payment.parent_email}</small>
                          )}
                        </div>
                      </td>
                      <td>{payment.description}</td>
                      <td>
                        <span className={`type-badge ${payment.type}`}>
                          {payment.type}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td>
                        <span className={`status-badge ${payment.status}`}>
                          {getStatusIcon(payment.status)}
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PaymentHistory
