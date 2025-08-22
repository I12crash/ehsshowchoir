import { useState, useEffect } from 'react'
import { get } from 'aws-amplify/api'
import type { Student, Payment, ApiResponse } from '../types'

export default function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [studentsResponse, paymentsResponse] = await Promise.all([
        get({ apiName: 'ehsAPI', path: '/students' }).response,
        get({ apiName: 'ehsAPI', path: '/paymenthistory' }).response
      ])

      const studentsResult = await studentsResponse.body.json() as ApiResponse<Student[]>
      const paymentsResult = await paymentsResponse.body.json() as ApiResponse<Payment[]>

      const studentsData = studentsResult.data
      const paymentsData = paymentsResult.data

      if (Array.isArray(studentsData)) {
        setStudents(studentsData)
      }

      if (Array.isArray(paymentsData)) {
        setPayments(paymentsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Create a map for quick student lookup
  const studentMap = students.reduce((acc: Record<string, Student>, student: Student) => {
    acc[student.id] = student
    return acc
  }, {})

  // Enhance payments with student info
  const enhancedPayments = payments.map((payment: Payment) => ({
    ...payment,
    studentName: studentMap[payment.studentId] 
      ? `${studentMap[payment.studentId].firstName} ${studentMap[payment.studentId].lastName}`
      : 'Unknown Student'
  }))

  if (loading) {
    return <div className="text-center py-8">Loading payment history...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enhancedPayments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(payment.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {payment.studentName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${payment.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {payment.method}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {payment.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    payment.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : payment.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {payment.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {enhancedPayments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No payment history found
          </div>
        )}
      </div>
    </div>
  )
}
