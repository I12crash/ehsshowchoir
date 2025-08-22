import { useState, useEffect } from 'react'
import { get, post } from 'aws-amplify/api'
import type { Student, InvoiceData, BulkInvoiceResult, ApiResponse } from '../types'

export default function InvoiceManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [lastBulkResult, setLastBulkResult] = useState<BulkInvoiceResult['results'] | null>(null)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const response = await get({
        apiName: 'ehsAPI',
        path: '/students'
      }).response
      
      const result = await response.body.json() as ApiResponse<Student[]>
      const studentsData = result.data
      
      if (Array.isArray(studentsData)) {
        setStudents(studentsData)
      }
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateBulkInvoices = async () => {
    try {
      const response = await post({
        apiName: 'ehsAPI',
        path: '/invoices/bulk-send',
        options: {
          body: {
            selectedStudents,
            includeHistory: true,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            invoiceDate: new Date().toISOString().split('T')[0],
          }
        }
      }).response

      const result = await response.body.json() as ApiResponse<BulkInvoiceResult>
      
      if (result.data?.results) {
        setLastBulkResult(result.data.results)
        const message = `Bulk invoice completed! ${result.data.results.successful} successful, ${result.data.results.failed} failed.`
        alert(message)
      }
    } catch (error) {
      console.error('Error generating bulk invoices:', error)
      alert('Error generating bulk invoices')
    }
  }

  const generateIndividualInvoice = async (studentId: string) => {
    try {
      const response = await post({
        apiName: 'ehsAPI',
        path: '/invoices/generate-individual',
        options: {
          body: {
            studentId,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            invoiceDate: new Date().toISOString().split('T')[0],
          }
        }
      }).response

      const result = await response.body.json() as ApiResponse<InvoiceData>
      
      if (result.data?.pdfUrl) {
        window.open(result.data.pdfUrl, '_blank')
      } else {
        alert('Invoice generated successfully')
      }
    } catch (error) {
      console.error('Error generating individual invoice:', error)
      alert('Error generating invoice')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading students...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Invoice Management</h1>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Bulk Invoice Generation</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Students
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2">
              {students.map((student) => (
                <label key={student.id} className="flex items-center space-x-2 p-1">
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudents([...selectedStudents, student.id])
                      } else {
                        setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">
                    {student.firstName} {student.lastName} - ${student.balance?.toFixed(2) || '0.00'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={generateBulkInvoices}
            disabled={selectedStudents.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            Generate Bulk Invoices ({selectedStudents.length} selected)
          </button>

          {lastBulkResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium text-gray-900">Last Bulk Result:</h3>
              <p className="text-sm text-gray-600">
                Successful: {lastBulkResult.successful}, Failed: {lastBulkResult.failed}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Individual Invoices</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => (
              <tr key={student.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {student.firstName} {student.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{student.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  ${student.balance?.toFixed(2) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => generateIndividualInvoice(student.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Generate Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
