import { useState, useEffect } from 'react';
import { get, post, put } from 'aws-amplify/api';

interface Student {
  studentId: string;
  schoolYear: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  choir: string[];
  parentIds: string[];
  balance: number;
}

interface Parent {
  parentId: string;
  firstName: string;
  lastName: string;
  email: string;
}

const CHOIRS = ['Music Warehouse', 'Sophisticated Ladies', 'Vocal Odyssey'];
const SCHOOL_YEARS = ['2024-2025', '2025-2026', '2026-2027'];

export default function StudentManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'male' as 'male' | 'female',
    schoolYear: '2024-2025',
    choir: [] as string[],
    parentIds: [] as string[],
  });

  useEffect(() => {
    fetchStudents();
    fetchParents();
  }, [selectedYear]);

  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: `/students?schoolYear=${selectedYear}`,
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const data = JSON.parse(text);
      console.log('Fetched students:', data);
      setStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
      setError('Failed to load students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchParents = async () => {
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: '/parents',
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const data = JSON.parse(text);
      console.log('Fetched parents:', data);
      setParents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch parents:', error);
      setParents([]);
    }
  };

  const handleAddStudent = async () => {
    if (!formData.firstName || !formData.lastName) {
      alert('Please enter first and last name');
      return;
    }
    
    if (formData.choir.length === 0) {
      alert('Please select at least one choir');
      return;
    }

    setError('');
    setSuccess('');
    
    try {
      console.log('Submitting student data:', formData);
      const restOperation = post({
        apiName: 'FosterAPI',
        path: '/students',
        options: {
          body: {
            ...formData,
            schoolYear: selectedYear,
          },
        },
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const newStudent = JSON.parse(text);
      console.log('Student created:', newStudent);
      
      await fetchStudents(); // Refresh the list
      setShowAddForm(false);
      setSuccess(`Student ${formData.firstName} ${formData.lastName} added successfully!`);
      setFormData({
        firstName: '',
        lastName: '',
        gender: 'male',
        schoolYear: selectedYear,
        choir: [],
        parentIds: [],
      });
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to add student:', error);
      setError('Failed to add student. Please try again.');
    }
  };

  const handleEditStudent = async () => {
    if (!editingStudent) return;
    
    if (!formData.firstName || !formData.lastName) {
      alert('Please enter first and last name');
      return;
    }
    
    if (formData.choir.length === 0) {
      alert('Please select at least one choir');
      return;
    }

    try {
      const restOperation = put({
        apiName: 'FosterAPI',
        path: `/students/${editingStudent.studentId}`,
        options: {
          body: formData,
        },
      });
      await restOperation.response;
      await fetchStudents();
      setShowEditForm(false);
      setEditingStudent(null);
      setSuccess('Student updated successfully!');
      setFormData({
        firstName: '',
        lastName: '',
        gender: 'male',
        schoolYear: selectedYear,
        choir: [],
        parentIds: [],
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to update student:', error);
      setError('Failed to update student');
    }
  };

  const startEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender || 'male',
      schoolYear: student.schoolYear,
      choir: student.choir || [],
      parentIds: student.parentIds || [],
    });
    setShowEditForm(true);
  };

  const handleChoirToggle = (choir: string) => {
    setFormData(prev => ({
      ...prev,
      choir: prev.choir.includes(choir)
        ? prev.choir.filter(c => c !== choir)
        : [...prev.choir, choir],
    }));
  };

  const handleParentToggle = (parentId: string) => {
    setFormData(prev => ({
      ...prev,
      parentIds: prev.parentIds.includes(parentId)
        ? prev.parentIds.filter(p => p !== parentId)
        : [...prev.parentIds, parentId],
    }));
  };

  const getParentNames = (parentIds: string[]) => {
    if (!parentIds || parentIds.length === 0) return 'None';
    return parentIds.map(id => {
      const parent = parents.find(p => p.parentId === id);
      return parent ? `${parent.firstName} ${parent.lastName}` : '';
    }).filter(Boolean).join(', ');
  };

  return (
    <div className="student-manager">
      <div className="manager-header">
        <h2>Student Management</h2>
        <div className="controls">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {SCHOOL_YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button onClick={() => {
            setFormData({
              firstName: '',
              lastName: '',
              gender: 'male',
              schoolYear: selectedYear,
              choir: [],
              parentIds: [],
            });
            setShowAddForm(true);
          }}>Add Student</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {(showAddForm || showEditForm) && (
        <div className="modal">
          <div className="modal-content">
            <h3>{showEditForm ? 'Edit Student' : 'Add New Student'}</h3>
            
            <input
              type="text"
              placeholder="First Name *"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            />
            
            <input
              type="text"
              placeholder="Last Name *"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            />
            
            <div className="radio-group">
              <h4>Gender:</h4>
              <label>
                <input
                  type="radio"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={(e) => setFormData({...formData, gender: 'male'})}
                />
                Male
              </label>
              <label>
                <input
                  type="radio"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={(e) => setFormData({...formData, gender: 'female'})}
                />
                Female
              </label>
            </div>
            
            <select
              value={formData.schoolYear}
              onChange={(e) => setFormData({...formData, schoolYear: e.target.value})}
            >
              {SCHOOL_YEARS.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            <div className="checkbox-group">
              <h4>Choirs: (Select at least one)</h4>
              {CHOIRS.map(choir => (
                <label key={choir}>
                  <input
                    type="checkbox"
                    checked={formData.choir.includes(choir)}
                    onChange={() => handleChoirToggle(choir)}
                  />
                  {choir}
                </label>
              ))}
            </div>

            {parents.length > 0 && (
              <div className="checkbox-group">
                <h4>Parents: (Optional)</h4>
                {parents.map(parent => (
                  <label key={parent.parentId}>
                    <input
                      type="checkbox"
                      checked={formData.parentIds.includes(parent.parentId)}
                      onChange={() => handleParentToggle(parent.parentId)}
                    />
                    {parent.firstName} {parent.lastName} ({parent.email})
                  </label>
                ))}
              </div>
            )}

            {parents.length === 0 && (
              <p className="info-message">Add parents first to link them to students</p>
            )}

            <div className="modal-buttons">
              <button onClick={showEditForm ? handleEditStudent : handleAddStudent}>
                {showEditForm ? 'Update' : 'Save'}
              </button>
              <button onClick={() => {
                setShowAddForm(false);
                setShowEditForm(false);
                setEditingStudent(null);
                setError('');
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading students...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Gender</th>
              <th>Choir(s)</th>
              <th>Parents</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center' }}>
                  No students found for {selectedYear}. Click "Add Student" to create one.
                </td>
              </tr>
            ) : (
              students.filter(s => s.schoolYear === selectedYear).map(student => (
                <tr key={student.studentId}>
                  <td>{student.firstName} {student.lastName}</td>
                  <td>{student.gender || 'Not specified'}</td>
                  <td>{student.choir?.join(', ') || 'None'}</td>
                  <td>{getParentNames(student.parentIds)}</td>
                  <td className={student.balance > 0 ? 'charge' : student.balance < 0 ? 'credit' : ''}>
                    ${Math.abs(student.balance || 0).toFixed(2)}
                    {student.balance > 0 ? ' (Owed)' : student.balance < 0 ? ' (Credit)' : ''}
                  </td>
                  <td>
                    <button onClick={() => startEdit(student)}>Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
