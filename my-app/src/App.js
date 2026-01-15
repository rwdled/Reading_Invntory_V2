import React, { useState, useEffect } from 'react';
import booksData from './Inventory';
import authService from './services/authService';
import bookService from './services/bookService';
import Login from './components/Login';
import './App.css';
// Books data

// Helper function to group books by genre
function groupBooksByGenre(books) {
  return books.reduce((groups, book) => {
    const genre = book.Genre || book.genre || 'Unknown';
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
    password: '',
    confirmPassword: '',
    parentEmail: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Basic validation
    if (!form.studentId || !form.name || !form.email || !form.password || !form.confirmPassword || !form.parentEmail) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email');
      setLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) {
      setError('Please enter a valid parent email');
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match, please try again');
      setLoading(false);
      return;
    }

    try {
      const userData = {
        userType: 'student',
        studentId: form.studentId,
        name: form.name,
        email: form.email,
        password: form.password,
        parentEmail: form.parentEmail
      };

      const result = await onSignup(userData);
      
      if (!result.success) {
        setError(result.error);
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="form-container fade-in-up">
        <h2 className="form-title">Student Signup</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Student ID:
              <input
                type="text"
                name="studentId"
                value={form.studentId}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your seven digit student ID (ex: 1234567)"
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Name:
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your full name"
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Email:
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your student email address (ex: 1234567@student.ssttx.org)"
              />
              <small className="form-help">Enter your student email address (ex: 1234567@student.ssttx.org)</small>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Password:
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your password (min 6 characters)"
                disabled={loading}
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Confirm Password:
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Confirm your password"
                disabled={loading}
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Parent Email:
              <input
                type="email"
                name="parentEmail"
                value={form.parentEmail}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter parent's email address"
                disabled={loading}
              />
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
            <button 
              type="button" 
              onClick={onBack} 
              className="btn btn-secondary"
              disabled={loading}
            >
              Back to Catalog
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Book Form Component
function AddBookForm({ onAddBook, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    author: '',
    genre: ''
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
    if (!form.title || !form.author || !form.genre) {
      setError('All fields are required');
      return;
    }

    setError('');
    onAddBook(form);
    // Reset form after successful submission
    setForm({ title: '', author: '', genre: '' });
  };

  return (
    <div className="app-container">
      <div className="form-container fade-in-up">
        <h2 className="form-title">Add New Book to Catalog</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Book Title:
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter book title"
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Author:
              <input
                type="text"
                name="author"
                value={form.author}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter author name"
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Genre:
              <input
                type="text"
                name="genre"
                value={form.genre}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter book genre (e.g., Fiction, Education, etc.)"
              />
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Add Book
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Staff/Admin Signup Component
function StaffSignup({ onSignup, onBack }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    role: 'staff',
    adminKeyword: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Basic validation
    if (!form.name || !form.email || !form.password || !form.confirmPassword || !form.department) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email');
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Check staff keyword for both staff and admin roles
    if (form.adminKeyword !== 'hemmy') {
      setError('Invalid staff keyword. Please enter the correct keyword to register as staff or admin.');
      setLoading(false);
      return;
    }

    try {
      const userData = {
        userType: 'staff',
        name: form.name,
        email: form.email,
        password: form.password,
        department: form.department,
        role: form.role,
        adminKeyword: form.adminKeyword
      };

      const result = await onSignup(userData);
      
      if (!result.success) {
        setError(result.error);
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="form-container fade-in-up">
        <h2 className="form-title">Staff/Admin Signup</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Name:
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your full name"
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Email:
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your email address"
                disabled={loading}
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Password:
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your password (min 6 characters)"
                disabled={loading}
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Confirm Password:
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Confirm your password"
                disabled={loading}
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Department:
              <input
                type="text"
                name="department"
                value={form.department}
                onChange={handleChange}
                required
                placeholder="e.g., Library, Administration"
                className="form-input"
                disabled={loading}
              />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Role:
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                className="form-select"
                disabled={loading}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Staff Keyword:
              <input
                type="password"
                name="adminKeyword"
                value={form.adminKeyword}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter staff keyword"
                disabled={loading}
              />
              <small className="form-help">Enter the special keyword to register as staff or admin (Hint: "hemmy")</small>
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
            <button 
              type="button" 
              onClick={onBack} 
              className="btn btn-secondary"
              disabled={loading}
            >
              Back to Catalog
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Import Sheets Form Component
function ImportSheetsForm({ onBack, onImportComplete }) {
  const [form, setForm] = useState({
    spreadsheetId: '',
    sheetName: '',
    apiKey: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
    setError('');
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    if (!form.spreadsheetId) {
      setError('Spreadsheet ID is required');
      setLoading(false);
      return;
    }

    try {
      const result = await bookService.importFromGoogleSheets(
        form.spreadsheetId,
        form.sheetName || null,
        form.apiKey || null
      );

      if (result.success) {
        setResult({
          message: `Successfully imported ${result.imported} out of ${result.total} books`,
          imported: result.imported,
          total: result.total,
          errors: result.errors
        });
        if (result.imported > 0) {
          setTimeout(() => {
            onImportComplete();
          }, 2000);
        }
      } else {
        setError(result.error || 'Failed to import books');
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="form-container fade-in-up">
        <h2 className="form-title">Import Books from Google Sheets</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Spreadsheet ID:
              <input
                type="text"
                name="spreadsheetId"
                value={form.spreadsheetId}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter Google Spreadsheet ID"
                disabled={loading}
              />
              <small className="form-help">
                You can find the Spreadsheet ID in the URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
              </small>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Sheet Name (optional):
              <input
                type="text"
                name="sheetName"
                value={form.sheetName}
                onChange={handleChange}
                className="form-input"
                placeholder="Sheet1 (default)"
                disabled={loading}
              />
              <small className="form-help">
                Leave empty to use the first sheet
              </small>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">
              Google API Key (optional):
              <input
                type="text"
                name="apiKey"
                value={form.apiKey}
                onChange={handleChange}
                className="form-input"
                placeholder="Leave empty for public sheets"
                disabled={loading}
              />
              <small className="form-help">
                Required only for private sheets. For public sheets, leave empty.
              </small>
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          {result && (
            <div className="success-message" style={{ 
              padding: '1rem', 
              backgroundColor: '#d4edda', 
              color: '#155724', 
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <p>{result.message}</p>
              {result.errors && result.errors.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>Errors:</strong>
                  <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                    {result.errors.map((err, idx) => (
                      <li key={idx} style={{ fontSize: '0.9em' }}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Importing...' : 'Import Books'}
            </button>
            <button 
              type="button" 
              onClick={onBack} 
              className="btn btn-secondary"
              disabled={loading}
            >
              Back to Catalog
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Import CSV Form Component
function ImportCsvForm({ onBack, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    if (!file) {
      setError('Please select a CSV file');
      setLoading(false);
      return;
    }

    try {
      const result = await bookService.importFromCsv(file);

      if (result.success) {
        setResult({
          message: `Successfully imported ${result.imported} out of ${result.total} books`,
          imported: result.imported,
          total: result.total,
          errors: result.errors
        });
        if (result.imported > 0) {
          setTimeout(() => {
            onImportComplete();
          }, 2000);
        }
      } else {
        setError(result.error || 'Failed to import books');
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="form-container fade-in-up">
        <h2 className="form-title">Import Books from CSV</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              CSV File:
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                required
                className="form-input"
                disabled={loading}
                style={{ padding: '0.5rem' }}
              />
              <small className="form-help">
                Select a CSV file with columns: Title, Author, Genre (optional), ISBN (optional)
              </small>
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          {result && (
            <div className="success-message" style={{ 
              padding: '1rem', 
              backgroundColor: '#d4edda', 
              color: '#155724', 
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <p>{result.message}</p>
              {result.errors && result.errors.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>Errors:</strong>
                  <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                    {result.errors.map((err, idx) => (
                      <li key={idx} style={{ fontSize: '0.9em' }}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading || !file}
            >
              {loading ? 'Importing...' : 'Import Books'}
            </button>
            <button 
              type="button" 
              onClick={onBack} 
              className="btn btn-secondary"
              disabled={loading}
            >
              Back to Catalog
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Staff Dashboard Component
function StaffDashboard({ onBack }) {
  const [rentals, setRentals] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentsError, setStudentsError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      const rentalsResult = await bookService.getAllRentals();
      if (rentalsResult.success) {
        setRentals(rentalsResult.rentals);
      } else {
        setError(rentalsResult.error || 'Failed to fetch rentals');
      }
      setLoading(false);

      setStudentsLoading(true);
      setStudentsError('');
      const studentsResult = await bookService.getAllStudents();
      if (studentsResult.success) {
        setStudents(studentsResult.students);
      } else {
        setStudentsError(studentsResult.error || 'Failed to fetch students');
      }
      setStudentsLoading(false);
    };
    fetchData();
  }, []);

  const handleReturnBook = async (bookId) => {
    const result = await bookService.returnBook(bookId);
    if (result.success) {
      alert('Book returned successfully!');
      // Refresh rentals
      const rentalsResult = await bookService.getAllRentals();
      if (rentalsResult.success) {
        setRentals(rentalsResult.rentals);
      }
    } else {
      alert(`Failed to return book: ${result.error}`);
    }
  };

  const activeRentals = rentals.filter(r => r.status === 'active');
  const returnedRentals = rentals.filter(r => r.status === 'returned');

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-content">
          <h1>📊 Staff Dashboard</h1>
          <h3>Book Rental Management</h3>
          <div className="btn-group">
            <button onClick={onBack} className="btn btn-secondary">
              ← Back to Catalog
            </button>
          </div>
        </div>
      </div>

      <div className="main-content">
        {/* Students Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h2>👥 Registered Students ({studentsLoading ? '...' : students.length})</h2>
          {studentsLoading ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p>Loading students...</p>
            </div>
          ) : studentsError ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#d32f2f' }}>
              <p>{studentsError}</p>
            </div>
          ) : students.length === 0 ? (
            <p>No registered students</p>
          ) : (
            <div style={{ 
              marginTop: '1rem',
              overflowX: 'auto'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: '#fff',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Student ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.75rem' }}>{student.name}</td>
                      <td style={{ padding: '0.75rem' }}>{student.email}</td>
                      <td style={{ padding: '0.75rem' }}>{student.student_id || 'N/A'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {student.created_at ? new Date(student.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rentals Section */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading rentals...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#d32f2f' }}>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h2>Active Rentals ({activeRentals.length})</h2>
              {activeRentals.length === 0 ? (
                <p>No active rentals</p>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: '1rem',
                  marginTop: '1rem'
                }}>
                  {activeRentals.map((rental) => (
                    <div 
                      key={rental.id} 
                      className="book-item"
                      style={{
                        padding: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: '#fff'
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>{rental.title}</h4>
                      <p><strong>Author:</strong> {rental.author}</p>
                      <p><strong>Genre:</strong> {rental.genre || 'N/A'}</p>
                      <hr style={{ margin: '0.75rem 0' }} />
                      <p><strong>Student:</strong> {rental.student_name}</p>
                      <p><strong>Student ID:</strong> {rental.student_id || 'N/A'}</p>
                      <p><strong>Email:</strong> {rental.student_email}</p>
                      <hr style={{ margin: '0.75rem 0' }} />
                      <p><strong>Checkout Date:</strong> {new Date(rental.checkout_date).toLocaleDateString()}</p>
                      <p><strong>Due Date:</strong> {new Date(rental.due_date).toLocaleDateString()}</p>
                      <button 
                        onClick={() => handleReturnBook(rental.book_id)}
                        className="btn btn-secondary"
                        style={{ marginTop: '0.5rem', width: '100%' }}
                      >
                        ↩️ Return Book
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2>Returned Books ({returnedRentals.length})</h2>
              {returnedRentals.length === 0 ? (
                <p>No returned books</p>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: '1rem',
                  marginTop: '1rem'
                }}>
                  {returnedRentals.map((rental) => (
                    <div 
                      key={rental.id} 
                      className="book-item"
                      style={{
                        padding: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: '#f5f5f5',
                        opacity: 0.8
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>{rental.title}</h4>
                      <p><strong>Author:</strong> {rental.author}</p>
                      <p><strong>Genre:</strong> {rental.genre || 'N/A'}</p>
                      <hr style={{ margin: '0.75rem 0' }} />
                      <p><strong>Student:</strong> {rental.student_name}</p>
                      <p><strong>Student ID:</strong> {rental.student_id || 'N/A'}</p>
                      <hr style={{ margin: '0.75rem 0' }} />
                      <p><strong>Checkout Date:</strong> {new Date(rental.checkout_date).toLocaleDateString()}</p>
                      <p><strong>Return Date:</strong> {rental.return_date ? new Date(rental.return_date).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('catalog'); // 'catalog', 'login', 'signup', 'staffSignup', 'addBook', 'staffDashboard', 'importSheets'
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [registeredStaff, setRegisteredStaff] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize authentication and fetch books on app load
  useEffect(() => {
    const initAuth = async () => {
      const authResult = await authService.init();
      if (authResult) {
        setCurrentUser(authService.getCurrentUser());
        setIsAuthenticated(true);
      }
    };
    initAuth();
  }, []);

  // Fetch books from API
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      const result = await bookService.getAllBooks();
      if (result.success) {
        setBooks(result.books);
      } else {
        // Fallback to static data if API fails
        console.error('Failed to fetch books:', result.error);
        setBooks(booksData);
      }
      setLoading(false);
    };
    fetchBooks();
  }, [currentPage]); // Refetch when page changes

  // Group books by genre
  const booksByGenre = groupBooksByGenre(books);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setCurrentPage('catalog');
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentPage('catalog');
  };

  const handleSignup = async (userData) => {
    try {
      const result = await authService.register(userData);
      if (result.success) {
        setRegisteredStudents([...registeredStudents, result.user]);
        alert(`Welcome, ${result.user.name}! You've been successfully registered.`);
        setCurrentPage('catalog');
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  };

  const handleStaffSignup = async (userData) => {
    try {
      const result = await authService.register(userData);
      if (result.success) {
        setRegisteredStaff([...registeredStaff, result.user]);
        alert(`Welcome, ${result.user.name}! You've been successfully registered as ${result.user.role}.`);
        setCurrentPage('catalog');
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  };

  const handleAddBook = async (bookData) => {
    const result = await bookService.addBook({
      title: bookData.title,
      author: bookData.author,
      genre: bookData.genre
    });
    if (result.success) {
      alert(`Book "${bookData.title}" by ${bookData.author} has been added to the catalog!`);
      // Refresh books list
      const booksResult = await bookService.getAllBooks();
      if (booksResult.success) {
        setBooks(booksResult.books);
      }
      setCurrentPage('catalog'); // Return to catalog after adding book
    } else {
      alert(`Failed to add book: ${result.error}`);
    }
  };

  const handleCheckoutBook = async (bookId) => {
    if (!isAuthenticated) {
      alert('Please login to checkout books');
      setCurrentPage('login');
      return;
    }

    if (currentUser.user_type !== 'student') {
      alert('Only students can checkout books');
      return;
    }

    const result = await bookService.checkoutBook(bookId);
    if (result.success) {
      alert('Book checked out successfully! Due date: ' + new Date(result.checkout.dueDate).toLocaleDateString());
      // Refresh books list
      const booksResult = await bookService.getAllBooks();
      if (booksResult.success) {
        setBooks(booksResult.books);
      }
    } else {
      alert(`Failed to checkout book: ${result.error}`);
    }
  };

  const handleReturnBook = async (bookId) => {
    const result = await bookService.returnBook(bookId);
    if (result.success) {
      alert('Book returned successfully!');
      // Refresh books list
      const booksResult = await bookService.getAllBooks();
      if (booksResult.success) {
        setBooks(booksResult.books);
      }
    } else {
      alert(`Failed to return book: ${result.error}`);
    }
  };

  const handleRefreshBooks = async () => {
    const result = await bookService.getAllBooks();
    if (result.success) {
      setBooks(result.books);
      alert('Books refreshed!');
    } else {
      alert(`Failed to refresh books: ${result.error}`);
    }
  };

  const navigateToLogin = () => {
    setCurrentPage('login');
  };

  const navigateToSignup = () => {
    setCurrentPage('signup');
  };

  const navigateToStaffSignup = () => {
    setCurrentPage('staffSignup');
  };

  const navigateToAddBook = () => {
    setCurrentPage('addBook');
  };

  const navigateToCatalog = () => {
    setCurrentPage('catalog');
  };

  const navigateToStaffDashboard = () => {
    setCurrentPage('staffDashboard');
  };

  const navigateToImportSheets = () => {
    setCurrentPage('importSheets');
  };

  const navigateToImportCsv = () => {
    setCurrentPage('importCsv');
  };

  const switchToSignup = () => {
    setCurrentPage('signup');
  };

  // Render Login page
  if (currentPage === 'login') {
    return <Login onLogin={handleLogin} onBack={navigateToCatalog} onSwitchToSignup={switchToSignup} />;
  }

  // Render Add Book page (requires authentication)
  if (currentPage === 'addBook') {
    if (!isAuthenticated) {
      return <Login onLogin={handleLogin} onBack={navigateToCatalog} onSwitchToSignup={switchToSignup} />;
    }
    return <AddBookForm onAddBook={handleAddBook} onCancel={navigateToCatalog} />;
  }

  // Render Staff Signup page
  if (currentPage === 'staffSignup') {
    return <StaffSignup onSignup={handleStaffSignup} onBack={navigateToCatalog} />;
  }

  // Render Student Signup page
  if (currentPage === 'signup') {
    return <Signup onSignup={handleSignup} onBack={navigateToCatalog} />;
  }

  // Render Import Sheets page (requires staff authentication)
  if (currentPage === 'importSheets') {
    if (!isAuthenticated || (currentUser?.user_type !== 'staff' && currentUser?.role !== 'admin')) {
      return <Login onLogin={handleLogin} onBack={navigateToCatalog} onSwitchToSignup={switchToSignup} />;
    }
    return <ImportSheetsForm onBack={navigateToCatalog} onImportComplete={() => {
      handleRefreshBooks();
      setCurrentPage('catalog');
    }} />;
  }

  // Render Import CSV page (requires staff authentication)
  if (currentPage === 'importCsv') {
    if (!isAuthenticated || (currentUser?.user_type !== 'staff' && currentUser?.role !== 'admin')) {
      return <Login onLogin={handleLogin} onBack={navigateToCatalog} onSwitchToSignup={switchToSignup} />;
    }
    return <ImportCsvForm onBack={navigateToCatalog} onImportComplete={() => {
      handleRefreshBooks();
      setCurrentPage('catalog');
    }} />;
  }

  // Render Staff Dashboard page (requires staff authentication)
  if (currentPage === 'staffDashboard') {
    if (!isAuthenticated || (currentUser?.user_type !== 'staff' && currentUser?.role !== 'admin')) {
      return <Login onLogin={handleLogin} onBack={navigateToCatalog} onSwitchToSignup={switchToSignup} />;
    }
    return <StaffDashboard onBack={navigateToCatalog} />;
  }

  // Render Catalog page
  return (
    <div className="app-container">
      <div className="header">
        <div className="header-content">
          <h1>📚 Reading Inventory Catalog</h1>
          <h3>Welcome to the Digital Library</h3>
          <p className="team-credit">Created and maintained by Capstone Team</p>
          
          {/* Authentication Status */}
          {isAuthenticated && currentUser ? (
            <div className="user-info">
              <p>Welcome, {currentUser.name}! ({currentUser.user_type})</p>
              <button onClick={handleLogout} className="btn btn-outline">
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-prompt">
              <p>Please login or signup to access all features</p>
            </div>
          )}
          
          <div className="btn-group">
            <button 
              onClick={handleRefreshBooks}
              className="btn btn-success"
            >
              🔄 Refresh Book List
            </button>
            {isAuthenticated && (currentUser?.user_type === 'staff' || currentUser?.role === 'admin') && (
              <>
                <button 
                  onClick={navigateToStaffDashboard}
                  className="btn btn-info"
                >
                  📊 Staff Dashboard
                </button>
                <button 
                  onClick={navigateToImportSheets}
                  className="btn btn-info"
                >
                  📥 Import from Google Sheets
                </button>
                <button 
                  onClick={navigateToImportCsv}
                  className="btn btn-info"
                >
                  📄 Import from CSV
                </button>
              </>
            )}
            {isAuthenticated ? (
              <button 
                onClick={navigateToAddBook}
                className="btn btn-warning"
              >
                📚 Add New Book
              </button>
            ) : (
              <button 
                onClick={navigateToLogin}
                className="btn btn-warning"
              >
                🔐 Login to Add Books
              </button>
            )}
            <button 
              onClick={navigateToSignup}
              className="btn btn-primary"
            >
              👨‍🎓 Student Signup
            </button>
            <button 
              onClick={navigateToStaffSignup}
              className="btn btn-info"
            >
              👨‍💼 Admin/Staff Signup
            </button>
            {!isAuthenticated && (
              <button 
                onClick={navigateToLogin}
                className="btn btn-secondary"
              >
                🔑 Login
              </button>
            )}
          </div>
          
          <div className="stats">
            {registeredStudents.length > 0 && (
              <div className="stat-item stat-students">
                👥 Registered Students: {registeredStudents.length}
              </div>
            )}
            {registeredStaff.length > 0 && (
              <div className="stat-item stat-staff">
                👨‍💼 Registered Staff: {registeredStaff.length}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="main-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading books...</p>
          </div>
        ) : Object.keys(booksByGenre).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>No books available. Add some books to get started!</p>
          </div>
        ) : (
          Object.keys(booksByGenre).sort().map((genre, genreIndex) => (
            <div key={genre} className="genre-section fade-in-up" style={{ animationDelay: `${genreIndex * 0.1}s` }}>
              <h3 className="genre-title">📖 {genre}</h3>
              <ul className="book-list">
                {booksByGenre[genre].map((book, idx) => {
                  const isAvailable = book.availability_status === 'available' || !book.availability_status;
                  const isCheckedOut = book.availability_status === 'checked_out';
                  const canRent = isAuthenticated && currentUser?.user_type === 'student' && isAvailable;
                  const canReturn = isAuthenticated && 
                    ((currentUser?.user_type === 'student' && book.checkout?.user_id === currentUser?.id) ||
                     (currentUser?.user_type === 'staff' || currentUser?.role === 'admin'));

                  return (
                    <li key={book.id || idx} className="book-item">
                      <div className="book-cover">
                        📖
                      </div>
                      <div className="book-info">
                        <h4 className="book-title">{book.title}</h4>
                        <p className="book-author">by {book.author}</p>
                        <div className="book-status">
                          {isAvailable ? (
                            <span className="status-badge status-available">✅ Available</span>
                          ) : isCheckedOut ? (
                            <span className="status-badge status-checked-out">📖 Checked Out</span>
                          ) : null}
                        </div>
                        {book.checkout && isCheckedOut && (
                          <p className="book-checkout-info" style={{ fontSize: '0.85em', color: '#666', marginTop: '0.5rem' }}>
                            {currentUser?.user_type === 'staff' || currentUser?.role === 'admin' ? (
                              <>Rented by: {book.checkout.student_name || book.checkout.user_id}</>
                            ) : (
                              <>You have this book</>
                            )}
                          </p>
                        )}
                        <div className="book-actions" style={{ marginTop: '0.5rem' }}>
                          {canRent && (
                            <button 
                              onClick={() => handleCheckoutBook(book.id)}
                              className="btn btn-primary"
                              style={{ fontSize: '0.85em', padding: '0.3rem 0.8rem' }}
                            >
                              📖 Rent Book
                            </button>
                          )}
                          {canReturn && isCheckedOut && (
                            <button 
                              onClick={() => handleReturnBook(book.id)}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.85em', padding: '0.3rem 0.8rem' }}
                            >
                              ↩️ Return Book
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        
        <div className="footer">
          <h1>💬 If you have any questions, please contact the staff.</h1>
          <h2>Made with ❤️ by Capstone Team</h2>
        </div>
      </div>
    </div>
  );
}

export default App;