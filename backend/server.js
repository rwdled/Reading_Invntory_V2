const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { google } = require('googleapis');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'A2!g7Y1Js#s*ULu9b2azNe679F';

//middleware i think this is for security
app.use(cors());
app.use(express.json());

// Configure multer for file uploads (CSV import)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// set up sqlite database
const dbPath = process.env.DATABASE_URL || './inventory_new.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        // Force recreate tables for production
        if (process.env.NODE_ENV === 'production') {
            console.log('Production environment detected - recreating database schema');
            recreateDatabase();
        } else {
            initializeDatabase();
        }
    }
});

function recreateDatabase() {
    // Drop existing tables and recreate them
    const dropSchema = `
    DROP TABLE IF EXISTS user_sessions;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS users;
    `;
    
    db.exec(dropSchema, (err) => {
        if (err) {
            console.error('Error dropping tables:', err);
        } else {
            console.log('Old tables dropped successfully');
            // Add a small delay to ensure tables are dropped
            setTimeout(() => {
                initializeDatabase();
            }, 100);
        }
    });
}

function initializeDatabase() {
    const schema = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_type TEXT NOT NULL CHECK (user_type IN ('student', 'staff', 'admin')),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        student_id TEXT,
        parent_email TEXT,
        department TEXT,
        role TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT,
        isbn TEXT,
        availability_status TEXT DEFAULT 'available',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS book_checkouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        checkout_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        due_date DATETIME NOT NULL,
        return_date DATETIME,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
    );
    `;
    
    db.exec(schema, (err) => {
        if (err) {
            console.error('Error creating tables:', err);
        } else {
            console.log('Tables created successfully');
            
            // After tables are created, check for missing columns and add them
            checkAndAddMissingColumns();
        }
        
        // Create indexes after tables are created
        const indexSchema = `
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_checkouts_user_id ON book_checkouts(user_id);
        CREATE INDEX IF NOT EXISTS idx_checkouts_book_id ON book_checkouts(book_id);
        CREATE INDEX IF NOT EXISTS idx_checkouts_status ON book_checkouts(status);
        `;
        
        db.exec(indexSchema, (err) => {
            if (err) {
                console.error('Error creating indexes:', err);
            } else {
                console.log('Indexes created successfully');
            }
        });
    });
}

function checkAndAddMissingColumns() {
    // Check if student_id column exists, if not, add it
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
            console.error('Error getting table info:', err);
            return;
        }
        
        const hasStudentId = columns.some(col => col.name === 'student_id');
        const hasRole = columns.some(col => col.name === 'role');
        
        if (!hasStudentId) {
            console.log('Adding student_id column to existing users table...');
            db.run("ALTER TABLE users ADD COLUMN student_id TEXT", (err) => {
                if (err) {
                    console.error('Error adding student_id column:', err);
                } else {
                    console.log('student_id column added successfully');
                }
            });
        }
        
        if (!hasRole) {
            console.log('Adding role column to existing users table...');
            db.run("ALTER TABLE users ADD COLUMN role TEXT", (err) => {
                if (err) {
                    console.error('Error adding role column:', err);
                } else {
                    console.log('role column added successfully');
                }
            });
        }
    });
}

//helper function to verify JWT token
function verifyJWTToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        console.error('Error verifying JWT token:', err);
        return null;
    }
}

//Database helper functions
async function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM users WHERE email = ?';
        db.get(sql, [email], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function findUserByStudentId(studentId) {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM users WHERE student_id = ?';
        db.get(sql, [studentId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function createUser(userData) {
    return new Promise((resolve, reject) => {
        // First check if role column exists
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            
            const hasRole = columns.some(col => col.name === 'role');
            const hasStudentId = columns.some(col => col.name === 'student_id');
            
            let sql, params;
            
            if (hasRole && hasStudentId) {
                // Full schema with all columns
                sql = 'INSERT INTO users (user_type, student_id, username, email, password_hash, parent_email, department, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                params = [
                    userData.userType,
                    userData.studentId,
                    userData.name,
                    userData.email,
                    userData.password_hash,
                    userData.parentEmail,
                    userData.department,
                    userData.role
                ];
            } else if (hasStudentId) {
                // Schema without role column
                sql = 'INSERT INTO users (user_type, student_id, username, email, password_hash, parent_email, department) VALUES (?, ?, ?, ?, ?, ?, ?)';
                params = [
                    userData.userType,
                    userData.studentId,
                    userData.name,
                    userData.email,
                    userData.password_hash,
                    userData.parentEmail,
                    userData.department
                ];
            } else {
                // Basic schema without student_id or role
                sql = 'INSERT INTO users (user_type, username, email, password_hash, parent_email, department) VALUES (?, ?, ?, ?, ?, ?)';
                params = [
                    userData.userType,
                    userData.name,
                    userData.email,
                    userData.password_hash,
                    userData.parentEmail,
                    userData.department
                ];
            }
            
            console.log('Executing SQL:', sql);
            console.log('With params:', params);
            
            db.run(sql, params, function(err) {
                if (err) {
                    console.error('Database error:', err);
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        ...userData
                    });
                }
            });
        });
    });
}

// Attach helper functions to db object
db.findUserByEmail = findUserByEmail;
db.findUserByStudentId = findUserByStudentId;
db.createUser = createUser;

//Routes

    //Health check endpoint 
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', message: 'Server is running'});
    });

    //Register new user
    app.post('/api/auth/register', async (req, res) => {
        try {
            const { userType, studentId, name, email, password, parentEmail, department, role, adminKeyword } = req.body;
            if (!userType || !name || !email || !password) {
                return res.status(400).json({ message: 'name, email, and password are required' });
            }
            if (userType === 'staff' && adminKeyword !== 'hemmy') {
                return res.status(400).json({ message: 'invalid staff keyword. Only authorized personnel can register as staff or admin.' });
            }
            const existingUser = await db.findUserByEmail(email);
            if (existingUser) {
                return res.status(400).json({ message: 'user with this email already exists' });
            }
            if (userType === 'student' && studentId) {
                const existingStudent = await db.findUserByStudentId(studentId);
                if (existingStudent) {
                    return res.status(400).json({ message: 'student id already exists' });
                }
            }
            //Hash password
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            const userData = {
                userType,
                studentId: userType === 'student' ? studentId : null,
                name,
                email,
                password_hash: passwordHash,
                parentEmail: userType === 'student' ? parentEmail : null,
                department: userType === 'staff' ? department : null,
                role: userType === 'staff' ? role : null
            };
            const newUser = await db.createUser(userData);
            const { password_hash, ...userResponse } = newUser;
            res.status(201).json({ message: 'User created successfully', user: userResponse });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
    //Login user
    app.post('/api/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: 'email and password are required' });
            }
            const user = await db.findUserByEmail(email);
            if (!user) {
                return res.status(401).json({ message: 'invalid credentials' });
            }
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'invalid credentials' });
            }

            //Create JWT token
            const sessionToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
            
            //store session in database
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            db.run('INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)', [user.id, sessionToken, expiresAt], (err) => {
                if (err) {
                    console.error('Error storing session:', err);
                    return res.status(500).json({ message: 'Internal server error' });
                }
                
                //update last login
                db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id], (err) => {
                    if (err) {
                        console.error('Error updating last login:', err);
                    }
                    
                    //return user data (without password hash)
                    const userData = {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        userType: user.user_type,
                        studentId: user.student_id,
                        department: user.department,
                        role: user.role,
                        lastLogin: user.last_login
                    };
                    res.json({ message: 'Login successful', user: userData, sessionToken });
                });
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });

//Validate session
app.post('/api/auth/validate', async (req, res) => {
    try {
        const { sessionToken } = req.body;
        if (!sessionToken) {
            return res.status(401).json({ message: 'Session token is required' });
        }
        const decoded = verifyJWTToken(sessionToken);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid or expired session' });
        }
        
        //check if session in database and is not expired
        const sql = 'SELECT u.*, s.expires_at FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.session_token = ? AND s.expires_at > CURRENT_TIMESTAMP';
        db.get(sql, [sessionToken], (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            if (!user) {
                return res.status(401).json({ message: 'Invalid or expired session' });
            }
            const userData = {
                id: user.id,
                userType: user.user_type,
                studentId: user.student_id,
                name: user.name,
                email: user.email,
                department: user.department,
                role: user.role,
            };
            res.json({ message: 'Session validated', user: userData });
        });
    } catch (error) {
        console.error('Session validation error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
//Logout user
app.post('/api/auth/logout', (req, res) => {
    try {
        const { sessionToken } = req.body;
        if (!sessionToken) {
            return res.status(401).json({ message: 'Session token is required' });
        }
        db.run('DELETE FROM user_sessions WHERE session_token = ?', [sessionToken], (err) => {
            if (err) {
                console.error('Error deleting session:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            return res.json({ message: 'Logout successful' });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Get all books with checkout info
app.get('/api/books', (req, res) => {
  const sql = `
    SELECT 
      b.*,
      bc.id as checkout_id,
      bc.user_id as checkout_user_id,
      bc.due_date as checkout_due_date,
      bc.checkout_date,
      u.name as checkout_student_name,
      u.email as checkout_student_email,
      u.student_id as checkout_student_id
    FROM books b
    LEFT JOIN book_checkouts bc ON b.id = bc.book_id AND bc.status = 'active'
    LEFT JOIN users u ON bc.user_id = u.id
    ORDER BY b.title
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    // Format books with checkout info
    const books = rows.map(row => {
      const book = {
        id: row.id,
        title: row.title,
        author: row.author,
        genre: row.genre,
        isbn: row.isbn,
        availability_status: row.availability_status,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
      
      // Add checkout info if exists
      if (row.checkout_id) {
        book.checkout = {
          id: row.checkout_id,
          user_id: row.checkout_user_id,
          due_date: row.checkout_due_date,
          checkout_date: row.checkout_date,
          student_name: row.checkout_student_name,
          student_email: row.checkout_student_email,
          student_id: row.checkout_student_id
        };
      }
      
      return book;
    });
    
    res.json(books);
  });
});

// Add new book (requires authentication)
app.post('/api/books', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyJWTToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { title, author, genre, isbn } = req.body;

    if (!title || !author) {
      return res.status(400).json({ message: 'Title and author are required' });
    }

    const sql = 'INSERT INTO books (title, author, genre, isbn) VALUES (?, ?, ?, ?)';

    db.run(sql, [title, author, genre, isbn], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to add book', error: err.message });
      }

      res.status(201).json({
        message: 'Book added successfully',
        book: {
          id: this.lastID,
          title,
          author,
          genre,
          isbn
        }
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Import books from Google Sheets (requires staff authentication)
app.post('/api/books/import-sheets', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyJWTToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get user to check if they're staff/admin
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!user || (user.user_type !== 'staff' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Only staff and admin can import books' });
      }

      const { spreadsheetId, sheetName, apiKey } = req.body;

      if (!spreadsheetId) {
        return res.status(400).json({ message: 'Spreadsheet ID is required' });
      }

      try {
        // For public sheets, we can use the public CSV export or API key
        // If no API key provided, we'll try to use the public CSV endpoint
        const range = sheetName ? `${sheetName}!A:Z` : 'Sheet1!A:Z';
        let response;
        
        if (apiKey || process.env.GOOGLE_API_KEY) {
          // Use Google Sheets API with API key
          const sheets = google.sheets({ 
            version: 'v4', 
            auth: apiKey || process.env.GOOGLE_API_KEY 
          });
          
          response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
          });
        } else {
          // Try public CSV export as fallback
          const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName || 'Sheet1'}`;
          
          // Use built-in fetch (Node 18+) or https module (older versions)
          let csvText;
          if (typeof fetch !== 'undefined') {
            // Node 18+ has built-in fetch
            const csvResponse = await fetch(csvUrl);
            csvText = await csvResponse.text();
          } else {
            // Fall back to https module for older Node versions
            const https = require('https');
            csvText = await new Promise((resolve, reject) => {
              https.get(csvUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve(data));
                res.on('error', reject);
              }).on('error', reject);
            });
          }
          
          // Parse CSV to rows (handle quoted fields properly)
          const rows = csvText.split('\n')
            .filter(row => row.trim())
            .map(row => {
              const fields = [];
              let currentField = '';
              let insideQuotes = false;
              
              for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') {
                  insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                  fields.push(currentField.trim());
                  currentField = '';
                } else {
                  currentField += char;
                }
              }
              fields.push(currentField.trim());
              return fields;
            });
          
          response = { data: { values: rows } };
        }

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          return res.status(400).json({ message: 'No data found in spreadsheet' });
        }

        // Assume first row is headers: Title, Author, Genre, ISBN
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const titleIdx = headers.findIndex(h => h.includes('title'));
        const authorIdx = headers.findIndex(h => h.includes('author'));
        const genreIdx = headers.findIndex(h => h.includes('genre') || h.includes('category'));
        const isbnIdx = headers.findIndex(h => h.includes('isbn'));

        if (titleIdx === -1 || authorIdx === -1) {
          return res.status(400).json({ message: 'Spreadsheet must have Title and Author columns' });
        }

        const booksToImport = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[titleIdx] || !row[authorIdx]) continue; // Skip empty rows

          booksToImport.push({
            title: row[titleIdx].trim(),
            author: row[authorIdx].trim(),
            genre: genreIdx >= 0 && row[genreIdx] ? row[genreIdx].trim() : null,
            isbn: isbnIdx >= 0 && row[isbnIdx] ? row[isbnIdx].trim() : null
          });
        }

        // Insert books into database
        let imported = 0;
        let errors = [];
        for (const book of booksToImport) {
          db.run(
            'INSERT OR IGNORE INTO books (title, author, genre, isbn) VALUES (?, ?, ?, ?)',
            [book.title, book.author, book.genre, book.isbn],
            function(err) {
              if (err) {
                errors.push(`Failed to import "${book.title}": ${err.message}`);
              } else if (this.changes > 0) {
                imported++;
              }
            }
          );
        }

        // Wait a bit for async operations
        setTimeout(() => {
          res.json({
            message: 'Import completed',
            imported,
            total: booksToImport.length,
            errors: errors.length > 0 ? errors : undefined
          });
        }, 500);

      } catch (error) {
        console.error('Google Sheets API error:', error);
        return res.status(500).json({
          message: 'Failed to import from Google Sheets',
          error: error.message
        });
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Import books from CSV file (requires staff authentication)
app.post('/api/books/import-csv', upload.single('file'), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyJWTToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get user to check if they're staff/admin
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!user || (user.user_type !== 'staff' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Only staff and admin can import books' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'CSV file is required' });
      }

      try {
        // Parse CSV file
        const csvText = req.file.buffer.toString('utf-8');
        const records = parse(csvText, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
          relax_column_count: true
        });

        if (!records || records.length === 0) {
          return res.status(400).json({ message: 'No data found in CSV file' });
        }

        // Find column indices (case-insensitive)
        const firstRecord = records[0];
        const headers = Object.keys(firstRecord).map(h => h.toLowerCase().trim());
        const titleKey = Object.keys(firstRecord).find(k => k.toLowerCase().trim().includes('title'));
        const authorKey = Object.keys(firstRecord).find(k => k.toLowerCase().trim().includes('author'));
        const genreKey = Object.keys(firstRecord).find(k => k.toLowerCase().trim().includes('genre') || k.toLowerCase().trim().includes('category'));
        const isbnKey = Object.keys(firstRecord).find(k => k.toLowerCase().trim().includes('isbn'));

        if (!titleKey || !authorKey) {
          return res.status(400).json({ message: 'CSV must have Title and Author columns' });
        }

        const booksToImport = [];
        for (const record of records) {
          const title = record[titleKey]?.trim();
          const author = record[authorKey]?.trim();
          
          if (!title || !author) continue; // Skip empty rows

          booksToImport.push({
            title,
            author,
            genre: genreKey && record[genreKey] ? record[genreKey].trim() : null,
            isbn: isbnKey && record[isbnKey] ? record[isbnKey].trim() : null
          });
        }

        // Insert books into database
        let imported = 0;
        let errors = [];
        let completed = 0;

        if (booksToImport.length === 0) {
          return res.status(400).json({ message: 'No valid books found in CSV file' });
        }

        for (const book of booksToImport) {
          db.run(
            'INSERT OR IGNORE INTO books (title, author, genre, isbn) VALUES (?, ?, ?, ?)',
            [book.title, book.author, book.genre, book.isbn],
            function(err) {
              completed++;
              if (err) {
                errors.push(`Failed to import "${book.title}": ${err.message}`);
              } else if (this.changes > 0) {
                imported++;
              }

              // Send response when all books are processed
              if (completed === booksToImport.length) {
                res.json({
                  message: 'Import completed',
                  imported,
                  total: booksToImport.length,
                  errors: errors.length > 0 ? errors : undefined
                });
              }
            }
          );
        }
      } catch (error) {
        console.error('CSV parsing error:', error);
        return res.status(500).json({
          message: 'Failed to parse CSV file',
          error: error.message
        });
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Checkout a book (student action)
app.post('/api/books/:bookId/checkout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyJWTToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const bookId = parseInt(req.params.bookId);

    // Get user
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!user || user.user_type !== 'student') {
        return res.status(403).json({ message: 'Only students can checkout books' });
      }

      // Check if book exists and is available
      db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, book) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        if (!book) {
          return res.status(404).json({ message: 'Book not found' });
        }

        // Check if book is already checked out
        db.get(
          'SELECT * FROM book_checkouts WHERE book_id = ? AND status = ?',
          [bookId, 'active'],
          (err, existingCheckout) => {
            if (err) {
              return res.status(500).json({ message: 'Database error', error: err.message });
            }
            if (existingCheckout) {
              return res.status(400).json({ message: 'Book is already checked out' });
            }

            // Check if student already has this book
            db.get(
              'SELECT * FROM book_checkouts WHERE user_id = ? AND book_id = ? AND status = ?',
              [decoded.userId, bookId, 'active'],
              (err, studentCheckout) => {
                if (err) {
                  return res.status(500).json({ message: 'Database error', error: err.message });
                }
                if (studentCheckout) {
                  return res.status(400).json({ message: 'You already have this book checked out' });
                }

                // Calculate due date (14 days from now)
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 14);

                // Create checkout
                db.run(
                  'INSERT INTO book_checkouts (user_id, book_id, due_date) VALUES (?, ?, ?)',
                  [decoded.userId, bookId, dueDate.toISOString()],
                  function(err) {
                    if (err) {
                      return res.status(500).json({ message: 'Failed to checkout book', error: err.message });
                    }

                    // Update book status
                    db.run(
                      'UPDATE books SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                      ['checked_out', bookId],
                      (err) => {
                        if (err) {
                          console.error('Error updating book status:', err);
                        }

                        res.json({
                          message: 'Book checked out successfully',
                          checkout: {
                            id: this.lastID,
                            bookId,
                            userId: decoded.userId,
                            dueDate: dueDate.toISOString()
                          }
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Return a book
app.post('/api/books/:bookId/return', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyJWTToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const bookId = parseInt(req.params.bookId);

    // Find active checkout
    db.get(
      'SELECT * FROM book_checkouts WHERE book_id = ? AND status = ?',
      [bookId, 'active'],
      (err, checkout) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        if (!checkout) {
          return res.status(404).json({ message: 'No active checkout found for this book' });
        }

        // Check if user is the one who checked it out or is staff/admin
        db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
          if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
          }
          if (!user) {
            return res.status(401).json({ message: 'User not found' });
          }

          if (checkout.user_id !== decoded.userId && user.user_type !== 'staff' && user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only return books you checked out' });
          }

          // Update checkout status
          db.run(
            'UPDATE book_checkouts SET status = ?, return_date = CURRENT_TIMESTAMP WHERE id = ?',
            ['returned', checkout.id],
            (err) => {
              if (err) {
                return res.status(500).json({ message: 'Failed to return book', error: err.message });
              }

              // Update book status
              db.run(
                'UPDATE books SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['available', bookId],
                (err) => {
                  if (err) {
                    console.error('Error updating book status:', err);
                  }

                  res.json({ message: 'Book returned successfully' });
                }
              );
            }
          );
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all rentals (staff/admin only)
app.get('/api/rentals', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyJWTToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check if user is staff/admin
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!user || (user.user_type !== 'staff' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Only staff and admin can view rentals' });
      }

      const sql = `
        SELECT 
          bc.*,
          u.name as student_name,
          u.email as student_email,
          u.student_id,
          b.title,
          b.author,
          b.genre
        FROM book_checkouts bc
        JOIN users u ON bc.user_id = u.id
        JOIN books b ON bc.book_id = b.id
        ORDER BY bc.checkout_date DESC
      `;

      db.all(sql, [], (err, rentals) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        res.json(rentals);
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all students (staff/admin only)
app.get('/api/students', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyJWTToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check if user is staff/admin
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!user || (user.user_type !== 'staff' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Only staff and admin can view students' });
      }

      const sql = `
        SELECT id, name, email, student_id, created_at
        FROM users
        WHERE user_type = 'student'
        ORDER BY created_at DESC
      `;

      db.all(sql, [], (err, students) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        res.json({
          count: students.length,
          students: students
        });
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get book details with checkout info
app.get('/api/books/:bookId', (req, res) => {
  const bookId = parseInt(req.params.bookId);
  
  db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, book) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Get active checkout info if any
    db.get(
      `SELECT bc.*, u.name as student_name, u.email as student_email, u.student_id 
       FROM book_checkouts bc 
       JOIN users u ON bc.user_id = u.id 
       WHERE bc.book_id = ? AND bc.status = ?`,
      [bookId, 'active'],
      (err, checkout) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        res.json({
          ...book,
          checkout: checkout || null
        });
      }
    );
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

