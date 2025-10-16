// Signup.js
import React, { useState } from 'react';

function Signup({ onSignup }) {
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
    <div style={{ maxWidth: 400, margin: '2rem auto' }}>
      <h2>Student Signup</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Student ID:
            <input
              type="text"
              name="studentId"
              value={form.studentId}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
            />
          </label>
        </div>
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
            Parent Email:
            <input
              type="email"
              name="parentEmail"
              value={form.parentEmail}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
            />
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

export default Signup;