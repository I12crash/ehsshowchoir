import { useState, useEffect } from 'react';
import { get, post } from 'aws-amplify/api';

interface Transaction {
  transactionId: string;
  date: string;
  studentId: string;
  schoolYear: string;
  description: string;
  type: 'charge' | 'credit';
  amount: number;
  notes?: string;
}

interface Student {
  studentId: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  schoolYear: string;
  choir: string[];
}

const CHOIRS = ['Music Warehouse', 'Sophisticated Ladies', 'Vocal Odyssey'];

export default function TransactionManager() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    studentId: '',
    schoolYear: '2024-2025',
    description: '',
    type: 'charge' as 'charge' | 'credit',
    amount: '',
    notes: '',
  });

  const [bulkFormData, setBulkFormData] = useState({
    choir: '',
    gender: '',
    description: '',
    type: 'charge' as 'charge' | 'credit',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchTransactions();
    fetchStudents();
  }, [selectedYear]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: `/transactions?schoolYear=${selectedYear}`,
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const data = JSON.parse(text);
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
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
    }
  };

  const handleAddTransaction = async () => {
    if (!formData.studentId || !formData.description || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const restOperation = post({
        apiName: 'FosterAPI',
        path: '/transactions',
        options: {
          body: {
            ...formData,
            amount: amount,
            schoolYear: selectedYear,
          },
        },
      });
      await restOperation.response;
      await fetchTransactions();
      await fetchStudents(); // Refresh to update balances
      setShowAddForm(false);
      setSuccess('Transaction added successfully!');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        studentId: '',
        schoolYear: selectedYear,
        description: '',
        type: 'charge',
        amount: '',
        notes: '',
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to add transaction:', error);
      setError('Failed to add transaction');
    }
  };

  const handleBulkCharge = async () => {
    if (!bulkFormData.choir || !bulkFormData.description || !bulkFormData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(bulkFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (bulkFormData.choir === 'Music Warehouse' && !bulkFormData.gender) {
      if (!confirm('No gender filter selected. This will apply to all Music Warehouse students. Continue?')) {
        return;
      }
    }

    setError('');
    setSuccess('');

    try {
      const restOperation = post({
        apiName: 'FosterAPI',
        path: '/transactions/bulk',
        options: {
          body: {
            ...bulkFormData,
            amount: amount,
            schoolYear: selectedYear,
            gender: bulkFormData.choir === 'Music Warehouse' ? bulkFormData.gender : null,
          },
        },
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const result = JSON.parse(text);
      
      await fetchTransactions();
      await fetchStudents();
      setShowBulkForm(false);
      setSuccess(result.message || 'Bulk charge applied successfully!');
      setBulkFormData({
        choir: '',
        gender: '',
        description: '',
        type: 'charge',
        amount: '',
        date: new Date().toISOString().split('T')[0],
      });
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      console.error('Failed to apply bulk charge:', error);
      setError('Failed to apply bulk charge');
    }
  };

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.studentId === studentId);
    return student ? `${student.firstName} ${student.lastName}` : 'Unknown';
  };

  return (
    <div className="transaction-manager">
      <div className="manager-header">
        <h2>Transaction Management</h2>
        <div className="controls">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="2024-2025">2024-2025</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
          </select>
          <button onClick={() => setShowAddForm(true)}>Add Transaction</button>
          <button onClick={() => setShowBulkForm(true)}>Bulk Charge</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showAddForm && (
        <div className="modal">
          <div className="modal-content">
            <h3>Add New Transaction</h3>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
            <select
              value={formData.studentId}
              onChange={(e) => setFormData({...formData, studentId: e.target.value})}
            >
              <option value="">Select Student *</option>
              {students.map(student => (
                <option key={student.studentId} value={student.studentId}>
                  {student.firstName} {student.lastName} - {student.choir?.join(', ')}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Description *"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value as 'charge' | 'credit'})}
            >
              <option value="charge">Charge (Student Owes)</option>
              <option value="credit">Credit (Payment Received)</option>
            </select>
            <input
              type="number"
              placeholder="Amount *"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
            <textarea
              placeholder="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
            <div className="modal-buttons">
              <button onClick={handleAddTransaction}>Save</button>
              <button onClick={() => {
                setShowAddForm(false);
                setError('');
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showBulkForm && (
        <div className="modal">
          <div className="modal-content">
            <h3>Bulk Charge/Credit</h3>
            <select
              value={bulkFormData.choir}
              onChange={(e) => setBulkFormData({...bulkFormData, choir: e.target.value})}
            >
              <option value="">Select Choir *</option>
              {CHOIRS.map(choir => (
                <option key={choir} value={choir}>{choir}</option>
              ))}
            </select>
            
            {bulkFormData.choir === 'Music Warehouse' && (
              <div className="gender-filter">
                <label>
                  Gender Filter (Music Warehouse only):
                </label>
                <select
                  value={bulkFormData.gender}
                  onChange={(e) => setBulkFormData({...bulkFormData, gender: e.target.value})}
                >
                  <option value="">All Students</option>
                  <option value="male">Male Only</option>
                  <option value="female">Female Only</option>
                </select>
              </div>
            )}
            
            <input
              type="text"
              placeholder="Description *"
              value={bulkFormData.description}
              onChange={(e) => setBulkFormData({...bulkFormData, description: e.target.value})}
            />
            
            <select
              value={bulkFormData.type}
              onChange={(e) => setBulkFormData({...bulkFormData, type: e.target.value as 'charge' | 'credit'})}
            >
              <option value="charge">Charge (Students Owe)</option>
              <option value="credit">Credit (Payment to All)</option>
            </select>
            
            <input
              type="number"
              placeholder="Amount per student *"
              step="0.01"
              min="0"
              value={bulkFormData.amount}
              onChange={(e) => setBulkFormData({...bulkFormData, amount: e.target.value})}
            />
            
            <input
              type="date"
              value={bulkFormData.date}
              onChange={(e) => setBulkFormData({...bulkFormData, date: e.target.value})}
            />
            
            <div className="info-message">
              This will apply a {bulkFormData.type} of ${bulkFormData.amount || '0'} to all students in {bulkFormData.choir || 'the selected choir'}
              {bulkFormData.choir === 'Music Warehouse' && bulkFormData.gender && ` (${bulkFormData.gender} only)`}
            </div>
            
            <div className="modal-buttons">
              <button onClick={handleBulkCharge}>Apply Bulk {bulkFormData.type}</button>
              <button onClick={() => {
                setShowBulkForm(false);
                setError('');
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading transactions...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Description</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center' }}>
                  No transactions found. Add students first, then create transactions.
                </td>
              </tr>
            ) : (
              transactions.map(transaction => (
                <tr key={transaction.transactionId}>
                  <td>{transaction.date}</td>
                  <td>{getStudentName(transaction.studentId)}</td>
                  <td>{transaction.description}</td>
                  <td className={transaction.type}>{transaction.type}</td>
                  <td className={transaction.type === 'charge' ? 'charge' : 'credit'}>
                    ${(transaction.amount || 0).toFixed(2)}
                  </td>
                  <td>{transaction.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
