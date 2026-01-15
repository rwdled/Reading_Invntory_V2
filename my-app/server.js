const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('./src/database/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Initialize database
const db = new Database();

// Initialize database on server start
db.init().then(() => {
  console.log('Database initialized successfully');
}).catch(err => {
  console.error('Database initialization failed:', err);
  console.log('Server will continue without database features');
});

// API Routes

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userType, studentId, name, email, password, parentEmail, department, role, adminKeyword } = req.body;
    
    // Validate required fields
    if (!userType || !name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate staff keyword for all staff registrations
    if (userType === 'staff' && adminKeyword !== 'hemmy') {
      return res.status(400).json({ message: 'Invalid staff keyword. Only authorized personnel can register as staff or admin.' });
    }

    // Check if user already exists
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Check if student ID already exists (for students)
    if (userType === 'student' && studentId) {
      const existingStudent = await db.findUserByStudentId(studentId);
      if (existingStudent) {
        return res.status(400).json({ message: 'Student ID already exists' });
      }
    }

    // Create user
    const userData = {
      userType,
      studentId: userType === 'student' ? studentId : null,
      name,
      email,
      password,
      parentEmail: userType === 'student' ? parentEmail : null,
      department: userType === 'staff' ? department : null,
      role: userType === 'staff' ? role : null
    };

    const newUser = await db.createUser(userData);
    
    // Remove password from response
    const { password_hash, ...userResponse } = newUser;
    
    res.status(201).json({ 
      message: 'User created successfully',
      user: userResponse 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await db.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await db.updateLastLogin(user.id);

    // Create session
    const sessionToken = await db.createSession(user.id);

    // Remove password from response
    const { password_hash, ...userResponse } = user;
    
    res.json({
      message: 'Login successful',
      user: userResponse,
      sessionToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Validate session
app.post('/api/auth/validate', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(401).json({ message: 'Session token required' });
    }

    const user = await db.validateSession(sessionToken);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Remove password from response
    const { password_hash, ...userResponse } = user;
    
    res.json(userResponse);
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout user
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (sessionToken) {
      await db.deleteSession(sessionToken);
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (admin only)
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve React app for all other routes (fallback)
// Use app.use without a path so we don't trigger path-to-regexp parsing issues for '*'
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close();
  process.exit(0);
});
