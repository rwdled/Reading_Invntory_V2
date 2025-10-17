import React, { useState } from 'react';
import booksData from './Inventory';
// Books data

// Helper function to group books by genre
function groupBooksByGenre(books) {
  return books.reduce((groups, book) => {
    const genre = book.Genre || 'Unknown';
    if (!groups[genre]) {
      groups[genre] = [];
    }
    groups[genre].push(book);
    return groups;
  }, {});
}

// Student Signup Component
function Signup({ onSignup, onBack }) {
  const [form, setForm] = useState({
    studentId: '',
    name: '',
    email: '',
    parentEmail: ''
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!form.studentId || !form.name || !form.email || !form.parentEmail) {
      setError('All fields are required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) {
      setError('Please enter a valid parent email');
      return;
    }

    setError('');
    onSignup(form);
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: '1rem' }}>
      <h2>Student Signup</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Student ID:
          <input
            type="text"
            name="studentId"
            value={form.studentId}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Name:
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Email:
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Parent Email:
          <input
            type="email"
            name="parentEmail"
            value={form.parentEmail}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </label>
      </div>
      {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button 
          onClick={handleSubmit} 
          style={{ 
            padding: '0.75rem 1.5rem', 
            cursor: 'pointer',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Sign Up
        </button>
        <button 
          onClick={onBack} 
          style={{ 
            padding: '0.75rem 1.5rem', 
            cursor: 'pointer',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Back to Catalog
        </button>
      </div>
    </div>
  );
}

// Staff/Admin Signup Component
function StaffSignup({ onSignup, onBack }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    department: '',
    role: 'staff'
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!form.name || !form.email || !form.department) {
      setError('All fields are required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email');
      return;
    }

    setError('');
    onSignup(form);
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: '1rem' }}>
      <h2>Staff/Admin Signup</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Name:
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Email:
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Department:
          <input
            type="text"
            name="department"
            value={form.department}
            onChange={handleChange}
            required
            placeholder="e.g., Library, Administration"
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Role:
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            required
            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button 
          onClick={handleSubmit} 
          style={{ 
            padding: '0.75rem 1.5rem', 
            cursor: 'pointer',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Sign Up
        </button>
        <button 
          onClick={onBack} 
          style={{ 
            padding: '0.75rem 1.5rem', 
            cursor: 'pointer',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Back to Catalog
        </button>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [books, setBooks] = useState(booksData);
  const [currentPage, setCurrentPage] = useState('catalog'); // 'catalog', 'signup', or 'staffSignup'
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [registeredStaff, setRegisteredStaff] = useState([]);

  // Group books by genre
  const booksByGenre = groupBooksByGenre(books);

  const handleSignup = (studentData) => {
    setRegisteredStudents([...registeredStudents, studentData]);
    alert(`Welcome, ${studentData.name}! You've been successfully registered.`);
    setCurrentPage('catalog'); // Return to catalog after signup
  };

  const handleStaffSignup = (staffData) => {
    setRegisteredStaff([...registeredStaff, staffData]);
    alert(`Welcome, ${staffData.name}! You've been successfully registered as ${staffData.role}.`);
    setCurrentPage('catalog'); // Return to catalog after signup
  };

  const navigateToSignup = () => {
    setCurrentPage('signup');
  };

  const navigateToStaffSignup = () => {
    setCurrentPage('staffSignup');
  };

  const navigateToCatalog = () => {
    setCurrentPage('catalog');
  };

  // Render Staff Signup page
  if (currentPage === 'staffSignup') {
    return <StaffSignup onSignup={handleStaffSignup} onBack={navigateToCatalog} />;
  }

  // Render Student Signup page
  if (currentPage === 'signup') {
    return <Signup onSignup={handleSignup} onBack={navigateToCatalog} />;
  }

  // Render Catalog page
  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Reading Inventory Catalog </h1>
        <h3 style={{ marginTop: '0.5rem' }}>Welcome to the Library</h3>
        <h3 style={{ marginTop: '0.5rem', color: '#000000ff' }}>Created and maintained by Capstone Team</h3>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button 
            onClick={() => setBooks(booksData)}
            style={{ 
              padding: '0.5rem 1rem', 
              cursor: 'pointer',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Refresh Book List
          </button>
          <button 
            onClick={navigateToSignup}
            style={{ 
              padding: '0.5rem 1rem', 
              cursor: 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Student Signup
          </button>
          <button 
            onClick={navigateToStaffSignup}
            style={{ 
              padding: '0.5rem 1rem', 
              cursor: 'pointer',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Admin/Staff Signup
          </button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          {registeredStudents.length > 0 && (
            <p style={{ color: '#28a745', margin: '0.25rem 0' }}>
              Registered Students: {registeredStudents.length}
            </p>
          )}
          {registeredStaff.length > 0 && (
            <p style={{ color: '#17a2b8', margin: '0.25rem 0' }}>
              Registered Staff: {registeredStaff.length}
            </p>
          )}
        </div>
      </div>

      {Object.keys(booksByGenre).sort().map((genre) => (
        <div key={genre} style={{ marginBottom: '2rem' }}>
          <h3>{genre}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {booksByGenre[genre].map((book, idx) => (
              <li key={idx} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  width: '60px', 
                  height: '80px', 
                  backgroundColor: '#e0e0e0', 
                  marginRight: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#666'
                }}>
                  Cover
                </div>
                <span>{book.title} by {book.author}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <h1 style={{ textAlign: 'center', marginTop: '4rem', color: '#888' }}> If you have any questions, please contact the staff.</h1>
      <h2 style={{ textAlign: 'center', marginTop: '1rem', color: '#888' }}> Made with ❤️ by Capstone Team </h2>
    </div>
  );
}

export default App;