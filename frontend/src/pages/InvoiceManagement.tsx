import React, { useState, useEffect } from 'react'
import { get, post } from 'aws-amplify/api'
import { 
  Send, 
  Download, 
  Users, 
  Calendar, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Mail
} from 'lucide-react'

interface Student {
  id: string
  name: string
  grade: string
  parentEmail: string
  status: string
}

interface PaymentHistoryItem {
  id: string
  date: string
  amount: number
  description: string
  type: string
  status: string
}

interface InvoiceData {
  student: Student
  currentCharges: PaymentHistoryItem[]
  paymentHistory: PaymentHistoryItem[]
  balanceDue: number
  totalPaid: number
}

const InvoiceManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [bulkInvoiceSettings, setBulkInvoiceSettings] = useState({
    includeHistory: true,
    dueDate: '',
    invoiceDate: new Date().toISOString().split('T')[0]
  })
  const [isLoading, setIsLoading] = useState(false)
  const [lastBulkResult, setLastBulkResult] = useState<any>(null)
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)

  useEffect(() => {
    loadStudents()
  }, [])

  useEffect(() => {
    if (selectedStudent) {
      loadStudentInvoiceData(selectedStudent)
    } else {
      setInvoiceData(null)
    }
  }, [selectedStudent])

  const loadStudents = async () => {
    try {
      const response = await get({
        apiName: 'ehsshowchoirApi',
        path: '/students'
      }).response
      
      const studentsData = await response.body.json()
      setStudents(studentsData || [])
    } catch (error) {
      console.error('Error loading students:', error)
    }
  }

  const loadStudentInvoiceData = async (studentId: string) => {
    setIsLoadingStudent(true)
    try {
      const response = await get({
        apiName: 'ehsshowchoirApi',
        path: `/students/${studentId}/invoice-data`
      }).response
      
      const data = await response.body.json()
      setInvoiceData(data)
    } catch (error) {
      console.error('Error loading student invoice data:', error)
    } finally {
      setIsLoadingStudent(false)
    }
  }

  const handleBulkInvoiceSend = async () => {
    if (!bulkInvoiceSettings.dueDate) {
      alert('Please select a due date')
      return
    }

    setIsLoading(true)
    try {
      const response = await post({
        apiName: 'ehsshowchoirApi',
        path: '/invoices/bulk-send',
        options: {
          body: {
            ...bulkInvoiceSettings,
            selectedStudents: selectedStudents.length > 0 ? selectedStudents : undefined
          }
        }
      }).response

      const result = await response.body.json()
      setLastBulkResult(result.results)
      
      const message = `Bulk invoice completed! ${result.results.successful} successful, ${result.results.failed} failed.`
      alert(message)
    } catch (error) {
      console.error('Error sending bulk invoices:', error)
      alert('Error sending bulk invoices. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const generateIndividualInvoice = async () => {
    if (!selectedStudent) return
    
    try {
      const response = await post({
        apiName: 'ehsshowchoirApi',
        path: '/invoices/generate-individual',
        options: {
          body: {
            studentId: selectedStudent,
            includeHistory: true,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        }
      }).response

      const result = await response.body.json()
      
      if (result.pdfUrl) {
        window.open(result.pdfUrl, '_blank')
      }
      alert('Invoice generated successfully!')
    } catch (error) {
      console.error('Error generating individual invoice:', error)
      alert('Error generating invoice. Please try again.')
    }
  }

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const selectAllStudents = () => {
    setSelectedStudents(students.map(s => s.id))
  }

  const clearSelection = () => {
    setSelectedStudents([])
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="invoice-management">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Invoice Management</h1>
          <p className="page-subtitle">Send invoices to parents and manage payment collections</p>
        </div>

        {/* Bulk Invoice Section */}
        <div className="card-component">
          <div className="card-header">
            <h2 className="section-title">
              <Mail size={24} />
              Bulk Invoice Distribution
            </h2>
          </div>
          
          <div className="bulk-settings">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="invoiceDate">
                  <Calendar size={16} />
                  Invoice Date:
                </label>
                <input
                  type="date"
                  id="invoiceDate"
                  value={bulkInvoiceSettings.invoiceDate}
                  onChange={(e) => setBulkInvoiceSettings(prev => ({
                    ...prev,
                    invoiceDate: e.target.value
                  }))}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="dueDate">
                  <Clock size={16} />
                  Due Date: *
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={bulkInvoiceSettings.dueDate}
                  onChange={(e) => setBulkInvoiceSettings(prev => ({
                    ...prev,
                    dueDate: e.target.value
                  }))}
                  className="form-control"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={bulkInvoiceSettings.includeHistory}
                  onChange={(e) => setBulkInvoiceSettings(prev => ({
                    ...prev,
                    includeHistory: e.target.checked
                  }))}
                />
                Include full payment history in invoices
              </label>
            </div>
          </div>

          <div className="student-selection">
            <div className="selection-controls">
              <h3>
                <Users size={20} />
                Select Students (leave empty to send to all)
              </h3>
              <div className="action-buttons">
                <button 
                  onClick={selectAllStudents}
                  className="btn btn-secondary btn-small"
                  type="button"
                >
                  Select All
                </button>
                <button 
                  onClick={clearSelection}
                  className="btn btn-secondary btn-small"
                  type="button"
                >
                  Clear Selection
                </button>
              </div>
              <p className="selection-count">
                {selectedStudents.length > 0 
                  ? `${selectedStudents.length} students selected`
                  : 'All students will receive invoices'
                }
              </p>
            </div>

            <div className="students-grid">
              {students.map(student => (
                <div 
                  key={student.id} 
                  className={`student-card ${selectedStudents.includes(student.id) ? 'selected' : ''}`}
                  onClick={() => toggleStudentSelection(student.id)}
                >
                  <div className="student-info">
                    <h4>{student.name}</h4>
                    <p>Grade {student.grade}</p>
                    <p className="parent-email">{student.parentEmail}</p>
                  </div>
                  <div className="selection-indicator">
                    {selectedStudents.includes(student.id) && <CheckCircle size={20} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="action-section">
            <button
              onClick={handleBulkInvoiceSend}
              disabled={isLoading || !bulkInvoiceSettings.dueDate}
              className="btn btn-primary btn-large"
            >
              {isLoading ? (
                <>
                  <div className="btn-spinner"></div>
                  Sending Invoices...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Send Bulk Invoices
                </>
              )}
            </button>
          </div>

          {lastBulkResult && (
            <div className="bulk-result">
              <h3>Last Bulk Invoice Results</h3>
              <div className="result-stats">
                <div className="stat-item success">
                  <CheckCircle size={24} />
                  <span className="stat-number">{lastBulkResult.successful}</span>
                  <span className="stat-label">Successful</span>
                </div>
                <div className="stat-item error">
                  <AlertCircle size={24} />
                  <span className="stat-number">{lastBulkResult.failed}</span>
                  <span className="stat-label">Failed</span>
                </div>
                <div className="stat-item total">
                  <FileText size={24} />
                  <span className="stat-number">{lastBulkResult.total}</span>
                  <span className="stat-label">Total</span>
                </div>
              </div>
              
              {lastBulkResult.details && (
                <details className="result-details">
                  <summary>View Details</summary>
                  <div className="result-list">
                    {lastBulkResult.details.map((result: any, index: number) => (
                      <div key={index} className={`result-item ${result.success ? 'success' : 'error'}`}>
                        <span className="result-email">{result.parentEmail}</span>
                        <span className="result-status">
                          {result.success ? 'Sent' : 'Failed'}
                        </span>
                        {result.error && <span className="result-error">{result.error}</span>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Individual Student Invoice Section */}
        <div className="card-component">
          <div className="card-header">
            <h2 className="section-title">
              <FileText size={24} />
              Individual Student Invoice
            </h2>
          </div>
          
          <div className="form-group">
            <label htmlFor="studentSelect">Select Student:</label>
            <select
              id="studentSelect"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="form-control"
            >
              <option value="">Choose a student...</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} (Grade {student.grade})
                </option>
              ))}
            </select>
          </div>

          {isLoadingStudent && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading student data...</p>
            </div>
          )}

          {invoiceData && !isLoadingStudent && (
            <div className="student-invoice-details">
              <div className="student-header">
                <h3>{invoiceData.student.name}</h3>
                <p>Grade {invoiceData.student.grade} | {invoiceData.student.parentEmail}</p>
              </div>

              <div className="invoice-summary">
                <div className="summary-card balance-due">
                  <h4>Current Balance Due</h4>
                  <span className="amount">{formatCurrency(invoiceData.balanceDue)}</span>
                </div>
                <div className="summary-card total-paid">
                  <h4>Total Paid This Year</h4>
                  <span className="amount">{formatCurrency(invoiceData.totalPaid)}</span>
                </div>
              </div>

              {invoiceData.currentCharges.length > 0 && (
                <div className="current-charges">
                  <h4>Outstanding Charges</h4>
                  <div className="charges-list">
                    {invoiceData.currentCharges.map(charge => (
                      <div key={charge.id} className="charge-item">
                        <span className="charge-description">{charge.description}</span>
                        <span className="charge-type">{charge.type}</span>
                        <span className="charge-amount">{formatCurrency(charge.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invoiceData.paymentHistory.length > 0 && (
                <div className="payment-history">
                  <h4>Recent Payment History</h4>
                  <div className="history-list">
                    {invoiceData.paymentHistory.slice(0, 10).map(payment => (
                      <div key={payment.id} className="payment-item">
                        <span className="payment-date">
                          {new Date(payment.date).toLocaleDateString()}
                        </span>
                        <span className="payment-description">{payment.description}</span>
                        <span className="payment-type">{payment.type}</span>
                        <span className="payment-amount">{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="actions">
                <button
                  onClick={generateIndividualInvoice}
                  className="btn btn-primary"
                >
                  <Download size={16} />
                  Generate & Download Invoice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvoiceManagement
