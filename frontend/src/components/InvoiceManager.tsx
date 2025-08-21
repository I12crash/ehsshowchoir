import { useState, useEffect } from 'react';
import { get, post } from 'aws-amplify/api';

interface Student {
  studentId: string;
  firstName: string;
  lastName: string;
  schoolYear: string;
  balance: number;
}

export default function InvoiceManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [selectedYear]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: `/students?schoolYear=${selectedYear}`,
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const data = JSON.parse(text);
      setStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedStudent) {
      alert('Please select a student');
      return;
    }

    setSending(true);
    try {
      const restOperation = post({
        apiName: 'FosterAPI',
        path: '/invoices/send',
        options: {
          body: {
            studentId: selectedStudent,
            schoolYear: selectedYear,
            subject: emailSubject || `Show Choir Invoice - ${selectedYear}`,
            emailBody: emailBody,
          },
        },
      });
      await restOperation.response;
      alert('Invoice sent successfully!');
      setSelectedStudent('');
      setEmailSubject('');
      setEmailBody('');
    } catch (error) {
      console.error('Failed to send invoice:', error);
      alert('Failed to send invoice. Make sure parents are linked to the student.');
    } finally {
      setSending(false);
    }
  };

  const selectedStudentData = students.find(s => s.studentId === selectedStudent);

  return (
    <div className="invoice-manager">
      <div className="manager-header">
        <h2>Invoice Management</h2>
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(e.target.value)}
        >
          <option value="2024-2025">2024-2025</option>
          <option value="2025-2026">2025-2026</option>
          <option value="2026-2027">2026-2027</option>
        </select>
      </div>

      <div className="invoice-form">
        <h3>Send Invoice</h3>
        
        {students.length === 0 ? (
          <p className="info-message">Add students and link them to parents first to send invoices.</p>
        ) : (
          <>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="">Select Student</option>
              {students.map(student => (
                <option key={student.studentId} value={student.studentId}>
                  {student.firstName} {student.lastName} (Balance: ${(student.balance || 0).toFixed(2)})
                </option>
              ))}
            </select>

            {selectedStudentData && (
              <div className="student-info">
                <p><strong>Student:</strong> {selectedStudentData.firstName} {selectedStudentData.lastName}</p>
                <p><strong>Current Balance:</strong> ${(selectedStudentData.balance || 0).toFixed(2)}</p>
                <p className="info-message">Invoice will be sent to all linked parent email addresses</p>
              </div>
            )}

            <input
              type="text"
              placeholder="Email Subject (optional)"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />

            <textarea
              placeholder="Additional message for invoice email (optional)"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={5}
            />

            <button 
              onClick={handleSendInvoice} 
              disabled={!selectedStudent || sending}
            >
              {sending ? 'Sending...' : 'Send Invoice'}
            </button>
          </>
        )}
      </div>

      <div className="invoice-list">
        <h3>Students with Balances</h3>
        {loading ? (
          <div className="loading">Loading students...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.filter(s => s.balance && s.balance !== 0).length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center' }}>
                    No students with outstanding balances
                  </td>
                </tr>
              ) : (
                students.filter(s => s.balance && s.balance !== 0).map(student => (
                  <tr key={student.studentId}>
                    <td>{student.firstName} {student.lastName}</td>
                    <td className={student.balance > 0 ? 'charge' : 'credit'}>
                      ${Math.abs(student.balance).toFixed(2)}
                      {student.balance > 0 ? ' (Owed)' : ' (Credit)'}
                    </td>
                    <td>
                      <button onClick={() => setSelectedStudent(student.studentId)}>
                        Select for Invoice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
