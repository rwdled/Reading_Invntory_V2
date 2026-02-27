require('dotenv').config();
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

// Helper: extract session token from Authorization header or body
function getSessionToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.body?.sessionToken || req.query?.sessionToken || null;
}

// Auth middleware: attach req.user when token present
app.use(async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (token) {
      const user = await db.validateSession(token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
  }
  next();
});

// Require authentication
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

// Require staff/admin
function requireStaff(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const isStaff = req.user.user_type === 'staff' || req.user.role === 'admin' || req.user.user_type === 'admin';
  if (!isStaff) {
    return res.status(403).json({ message: 'Staff or admin access required' });
  }
  next();
}

// Require student
function requireStudent(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.user_type !== 'student') {
    return res.status(403).json({ message: 'Student access required' });
  }
  next();
}

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

// ---------------------------------------------------------------------------
// Books & Rentals
// ---------------------------------------------------------------------------

// Get all books
app.get('/api/books', async (req, res) => {
  try {
    const books = await db.getAllBooks(req.user || null);
    res.json(books);
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get book by id
app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await db.getBookById(req.params.id, req.user || null);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add new book (staff/admin only)
app.post('/api/books', requireStaff, async (req, res) => {
  try {
    const { title, author, genre, isbn, total_copies } = req.body;
    if (!title || !author) {
      return res.status(400).json({ message: 'Title and author are required' });
    }

    const book = await db.addBook({
      title,
      author,
      genre: genre || null,
      isbn: isbn || null,
      total_copies: Number(total_copies) > 0 ? Number(total_copies) : 1,
      created_by: req.user.id
    });

    res.status(201).json({ message: 'Book added', book });
  } catch (error) {
    console.error('Add book error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Checkout a book (students only)
app.post('/api/books/:id/checkout', requireStudent, async (req, res) => {
  try {
    const bookId = req.params.id;
    const result = await db.checkoutBook(bookId, req.user.id);
    res.json({
      message: 'Book checked out successfully',
      checkout: {
        dueDate: result.dueDate,
        checkoutId: result.checkoutId
      },
      availability: {
        available_copies: result.available_copies,
        availability_status: result.availability_status
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(400).json({ message: error.message || 'Failed to checkout book' });
  }
});

// Return a book
app.post('/api/books/:id/return', requireAuth, async (req, res) => {
  try {
    const bookId = req.params.id;
    const isStaff = req.user.user_type === 'staff' || req.user.role === 'admin' || req.user.user_type === 'admin';
    const result = await db.returnBook(bookId, req.user.id, isStaff);
    res.json({
      message: 'Book returned successfully',
      availability: result
    });
  } catch (error) {
    console.error('Return error:', error);
    res.status(400).json({ message: error.message || 'Failed to return book' });
  }
});

// Get all rentals (staff/admin)
app.get('/api/rentals', requireStaff, async (req, res) => {
  try {
    const rentals = await db.getAllRentals();
    res.json(rentals);
  } catch (error) {
    console.error('Get rentals error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all students (staff/admin)
app.get('/api/students', requireStaff, async (req, res) => {
  try {
    const students = await db.getAllStudentsWithCounts();
    res.json({ count: students.length, students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get students with rentals (teacher/staff)
app.get('/api/students/with-rentals', requireStaff, async (req, res) => {
  try {
    const students = await db.getStudentsWithRentals();
    res.json({ count: students.length, students });
  } catch (error) {
    console.error('Get students with rentals error:', error);
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
