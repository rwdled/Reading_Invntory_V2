import React, { useState } from 'react';

function AdminSignup({ onSignup }) {
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
    <div style={{ maxWidth: 400, margin: '2rem auto' }}>
      <h2>Staff/Admin Signup</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Email:
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Department:
            <input
              type="text"
              name="department"
              value={form.department}
              onChange={handleChange}
              required
              placeholder="e.g., Library, Administration"
              style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Role:
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
          Sign Up
        </button>
      </form>
    </div>
  );
}

export default AdminSignup;