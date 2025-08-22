import React, { useState, useEffect } from 'react'
import { get, post, put, del } from 'aws-amplify/api'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Users, 
  Mail,
  GraduationCap,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface Student {
  id: string
  name: string
  grade: string
  parentEmail: string
  status: string
  createdAt: string
  updatedAt?: string
}

const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  
  const [newStudent, setNewStudent] = useState({
    name: '',
    grade: '',
    parentEmail: ''
  })

  useEffect(() => {
    loadStudents()
  }, [])

  useEffect(() => {
    filterStudents()
  }, [students, searchTerm, statusFilter, gradeFilter])

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
    } finally {
      setIsLoading(false)
    }
  }

  const filterStudents = () => {
    let filtered = students

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.parentEmail.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(student => student.status === statusFilter)
    }

    // Grade filter
    if (gradeFilter !== 'all') {
      filtered = filtered.filter(student => student.grade === gradeFilter)
    }

    setFilteredStudents(filtered)
  }

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newStudent.name || !newStudent.grade || !newStudent.parentEmail) {
      alert('Please fill in all fields')
      return
    }

    try {
      const response = await post({
        apiName: 'ehsshowchoirApi',
        path: '/students',
        options: {
          body: newStudent
        }
      }).response

      const createdStudent = await response.body.json()
      setStudents([...students, createdStudent])
      setNewStudent({ name: '', grade: '', parentEmail: '' })
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding student:', error)
      alert('Error adding student. Please try again.')
    }
  }

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingStudent) return

    try {
      const response = await put({
        apiName: 'ehsshowchoirApi',
        path: `/students/${editingStudent.id}`,
        options: {
          body: {
            name: editingStudent.name,
            grade: editingStudent.grade,
            parentEmail: editingStudent.parentEmail,
            status: editingStudent.status
          }
        }
      }).response

      const updatedStudent = await response.body.json()
      setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s))
      setEditingStudent(null)
    } catch (error) {
      console.error('Error updating student:', error)
      alert('Error updating student. Please try again.')
    }
  }

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)) {
      return
    }
    
    try {
      await del({
        apiName: 'ehsshowchoirApi',
        path: `/students/${studentId}`
      }).response

      setStudents(students.filter(s => s.id !== studentId))
    } catch (error) {
      console.error('Error deleting student:', error)
      alert('Error deleting student. Please try again.')
    }
  }

  const getUniqueGrades = () => {
    const grades = [...new Set(students.map(s => s.grade))].sort()
    return grades
  }

  if (isLoading) {
    return (
      <div className="student-management">
        <div className="container">
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading students...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="student-management">
      <div className="container">
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">
              <Users size={32} />
              Student Management
            </h1>
            <p className="page-subtitle">Manage student records and contact information</p>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
          >
            <Plus size={20} />
            {showAddForm ? 'Cancel' : 'Add Student'}
          </button>
        </div>

        {/* Filters and Search */}
        <div className="card-component">
          <div className="filters-section">
            <div className="search-group">
              <div className="search-input">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div className="filter-group">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-control"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="filter-group">
              <GraduationCap size={16} />
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="form-control"
              >
                <option value="all">All Grades</option>
                {getUniqueGrades().map(grade => (
                  <option key={grade} value={grade}>Grade {grade}</option>
                ))}
              </select>
            </div>

            <div className="filter-results">
              <span className="results-count">
                {filteredStudents.length} of {students.length} students
              </span>
            </div>
          </div>
        </div>

        {/* Add Student Form */}
        {showAddForm && (
          <div className="card-component">
            <h2 className="section-title">Add New Student</h2>
            <form onSubmit={handleAddStudent} className="add-student-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Student Name: *</label>
                  <input
                    type="text"
                    id="name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="form-control"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="grade">Grade: *</label>
                  <select
                    id="grade"
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                    className="form-control"
                    required
                  >
                    <option value="">Select Grade</option>
                    <option value="9">9th Grade</option>
                    <option value="10">10th Grade</option>
                    <option value="11">11th Grade</option>
                    <option value="12">12th Grade</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="parentEmail">Parent Email: *</label>
                  <input
                    type="email"
                    id="parentEmail"
                    value={newStudent.parentEmail}
                    onChange={(e) => setNewStudent({ ...newStudent, parentEmail: e.target.value })}
                    className="form-control"
                    placeholder="parent@example.com"
                    required
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} />
                  Add Student
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Student Modal */}
        {editingStudent && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Edit Student</h2>
              <form onSubmit={handleEditStudent}>
                <div className="form-group">
                  <label htmlFor="editName">Student Name:</label>
                  <input
                    type="text"
                    id="editName"
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="editGrade">Grade:</label>
                  <select
                    id="editGrade"
                    value={editingStudent.grade}
                    onChange={(e) => setEditingStudent({ ...editingStudent, grade: e.target.value })}
                    className="form-control"
                    required
                  >
                    <option value="9">9th Grade</option>
                    <option value="10">10th Grade</option>
                    <option value="11">11th Grade</option>
                    <option value="12">12th Grade</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="editParentEmail">Parent Email:</label>
                  <input
                    type="email"
                    id="editParentEmail"
                    value={editingStudent.parentEmail}
                    onChange={(e) => setEditingStudent({ ...editingStudent, parentEmail: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="editStatus">Status:</label>
                  <select
                    id="editStatus"
                    value={editingStudent.status}
                    onChange={(e) => setEditingStudent({ ...editingStudent, status: e.target.value })}
                    className="form-control"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                
                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle size={16} />
                    Save Changes
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditingStudent(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Students Table */}
        <div className="card-component">
          <h2 className="section-title">Students ({filteredStudents.length})</h2>
          
          {filteredStudents.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <h3>No students found</h3>
              <p>
                {students.length === 0 
                  ? 'Add your first student to get started.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
              {students.length === 0 && (
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  Add First Student
                </button>
              )}
            </div>
          ) : (
            <div className="students-table-container">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Grade</th>
                    <th>Parent Email</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id}>
                      <td>
                        <div className="student-name">
                          <strong>{student.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="grade-badge">
                          Grade {student.grade}
                        </span>
                      </td>
                      <td>
                        <div className="email-cell">
                          <Mail size={14} />
                          {student.parentEmail}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${student.status}`}>
                          {student.status === 'active' ? (
                            <CheckCircle size={14} />
                          ) : (
                            <AlertCircle size={14} />
                          )}
                          {student.status}
                        </span>
                      </td>
                      <td>
                        {new Date(student.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="btn btn-small btn-secondary"
                            title="Edit Student"
                          >
                            <Edit size={14} />
                          </button>
                          <a 
                            href={`/invoices?student=${student.id}`}
                            className="btn btn-small btn-outline"
                            title="View Invoice"
                          >
                            View Invoice
                          </a>
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.name)}
                            className="btn btn-small btn-danger"
                            title="Delete Student"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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

export default StudentManagement
