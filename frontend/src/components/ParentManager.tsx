import { useState, useEffect } from 'react';
import { get, post } from 'aws-amplify/api';

interface Parent {
  parentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  studentIds: string[];
}

export default function ParentManager() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    fetchParents();
  }, []);

  const fetchParents = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleAddParent = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      alert('Please fill in all required fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      const restOperation = post({
        apiName: 'FosterAPI',
        path: '/parents',
        options: {
          body: formData,
        },
      });
      await restOperation.response;
      await fetchParents(); // Refresh the list
      setShowAddForm(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
      });
    } catch (error) {
      console.error('Failed to add parent:', error);
      alert('Failed to add parent');
    }
  };

  return (
    <div className="parent-manager">
      <div className="manager-header">
        <h2>Parent Management</h2>
        <button onClick={() => setShowAddForm(true)}>Add Parent</button>
      </div>

      {showAddForm && (
        <div className="modal">
          <div className="modal-content">
            <h3>Add New Parent</h3>
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
            <input
              type="email"
              placeholder="Email *"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
            <div className="modal-buttons">
              <button onClick={handleAddParent}>Save</button>
              <button onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading parents...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Linked Students</th>
            </tr>
          </thead>
          <tbody>
            {parents.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>
                  No parents found. Click "Add Parent" to create one.
                </td>
              </tr>
            ) : (
              parents.map(parent => (
                <tr key={parent.parentId}>
                  <td>{parent.firstName} {parent.lastName}</td>
                  <td>{parent.email}</td>
                  <td>{parent.phone || '-'}</td>
                  <td>{parent.studentIds?.length || 0} student(s)</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
