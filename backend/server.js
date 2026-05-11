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
        // IMPORTANT: never drop/recreate in production; SQLite must be persistent.
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Canonical schema aligned with my-app/src/database/schema.sql
    // (we still run follow-up migrations to handle older DBs).
    const schema = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_type TEXT NOT NULL CHECK (user_type IN ('student', 'staff', 'admin')),
        student_id TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        parent_email TEXT,
        department TEXT,
        role TEXT DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
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
        availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'checked_out', 'reserved')),
        total_copies INTEGER DEFAULT 1,
        available_copies INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS book_checkouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        checkout_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        due_date DATETIME NOT NULL,
        return_date DATETIME,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
        notes TEXT,
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
        CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
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
    migrateUsersTable();
    migrateBooksTable();
    migrateBookCheckoutsTable();
}

function migrateUsersTable() {
    db.all('PRAGMA table_info(users)', (err, columns) => {
        if (err) {
            console.error('Error getting users table info:', err);
            return;
        }

        const colNames = new Set(columns.map((c) => c.name));
        const has = (name) => colNames.has(name);

        const addColumn = (sql, label) => {
            db.run(sql, (e) => {
                if (e) {
                    console.error(`Error adding ${label} column:`, e.message);
                } else {
                    console.log(`${label} column ensured successfully`);
                }
            });
        };

        if (!has('name')) {
            console.log('Adding name column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN name TEXT', 'name');
        }
        if (!has('student_id')) {
            console.log('Adding student_id column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN student_id TEXT', 'student_id');
        }
        if (!has('parent_email')) {
            console.log('Adding parent_email column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN parent_email TEXT', 'parent_email');
        }
        if (!has('department')) {
            console.log('Adding department column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN department TEXT', 'department');
        }
        if (!has('role')) {
            console.log('Adding role column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN role TEXT', 'role');
        }
        if (!has('is_active')) {
            console.log('Adding is_active column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1', 'is_active');
        }
        if (!has('created_at')) {
            console.log('Adding created_at column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP', 'created_at');
        }
        if (!has('updated_at')) {
            console.log('Adding updated_at column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP', 'updated_at');
        }
        if (!has('last_login')) {
            console.log('Adding last_login column to existing users table...');
            addColumn('ALTER TABLE users ADD COLUMN last_login DATETIME', 'last_login');
        }

        // If an older DB used "username" instead of "name", backfill name from username.
        if (has('username')) {
            db.run('UPDATE users SET name = COALESCE(name, username) WHERE name IS NULL OR name = ""', (e) => {
                if (e) {
                    console.error('Error backfilling users.name from users.username:', e.message);
                }
            });
        }
    });
}

function migrateBooksTable() {
    db.all('PRAGMA table_info(books)', (err, columns) => {
        if (err) {
            console.error('Error getting books table info:', err);
            return;
        }

        const colNames = new Set(columns.map((c) => c.name));
        const has = (name) => colNames.has(name);

        const addColumn = (sql, label) => {
            db.run(sql, (e) => {
                if (e) {
                    console.error(`Error adding books.${label} column:`, e.message);
                } else {
                    console.log(`books.${label} column ensured successfully`);
                }
            });
        };

        if (!has('genre')) addColumn('ALTER TABLE books ADD COLUMN genre TEXT', 'genre');
        if (!has('isbn')) addColumn('ALTER TABLE books ADD COLUMN isbn TEXT', 'isbn');
        if (!has('availability_status')) addColumn("ALTER TABLE books ADD COLUMN availability_status TEXT DEFAULT 'available'", 'availability_status');
        if (!has('total_copies')) addColumn('ALTER TABLE books ADD COLUMN total_copies INTEGER DEFAULT 1', 'total_copies');
        if (!has('available_copies')) addColumn('ALTER TABLE books ADD COLUMN available_copies INTEGER DEFAULT 1', 'available_copies');
        if (!has('created_by')) addColumn('ALTER TABLE books ADD COLUMN created_by INTEGER', 'created_by');
        if (!has('created_at')) addColumn('ALTER TABLE books ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP', 'created_at');
        if (!has('updated_at')) addColumn('ALTER TABLE books ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP', 'updated_at');

        // Backfill copies if they exist but are NULL.
        if (has('total_copies')) {
            db.run('UPDATE books SET total_copies = COALESCE(total_copies, 1)', () => {});
        }
        if (has('available_copies')) {
            db.run('UPDATE books SET available_copies = COALESCE(available_copies, total_copies, 1)', () => {});
        }
    });
}

function migrateBookCheckoutsTable() {
    db.all('PRAGMA table_info(book_checkouts)', (err, columns) => {
        if (err) {
            console.error('Error getting book_checkouts table info:', err);
            return;
        }

        const colNames = new Set(columns.map((c) => c.name));
        const has = (name) => colNames.has(name);

        if (!has('notes')) {
            db.run('ALTER TABLE book_checkouts ADD COLUMN notes TEXT', (e) => {
                if (e) {
                    console.error('Error adding book_checkouts.notes column:', e.message);
                } else {
                    console.log('book_checkouts.notes column ensured successfully');
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
        const sql = 'SELECT * FROM users WHERE email = ? AND (is_active IS NULL OR is_active = 1)';
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
        const sql = 'SELECT * FROM users WHERE student_id = ? AND (is_active IS NULL OR is_active = 1)';
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
        db.all('PRAGMA table_info(users)', (err, columns) => {
            if (err) {
                reject(err);
                return;
            }

            const colNames = new Set(columns.map((c) => c.name));
            const has = (name) => colNames.has(name);

            const fields = [];
            const params = [];

            // Canonical column is `name`, but support older DBs with `username`.
            if (has('name')) {
                fields.push('name');
                params.push(userData.name);
            } else if (has('username')) {
                fields.push('username');
                params.push(userData.name);
            }

            fields.push('user_type');
            params.push(userData.userType);

            if (has('student_id')) {
                fields.push('student_id');
                params.push(userData.studentId);
            }

            fields.push('email');
            params.push(userData.email);

            fields.push('password_hash');
            params.push(userData.password_hash);

            if (has('parent_email')) {
                fields.push('parent_email');
                params.push(userData.parentEmail);
            }
            if (has('department')) {
                fields.push('department');
                params.push(userData.department);
            }
            if (has('role')) {
                fields.push('role');
                params.push(userData.role);
            }

            const placeholders = fields.map(() => '?').join(', ');
            const sql = `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders})`;
            
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
      const totalCopies = row.total_copies ?? null;
      const availableCopies = row.available_copies ?? null;
      const computedStatus =
        typeof availableCopies === 'number'
          ? availableCopies > 0
            ? 'available'
            : 'checked_out'
          : row.availability_status;

      const book = {
        id: row.id,
        title: row.title,
        author: row.author,
        genre: row.genre,
        isbn: row.isbn,
        availability_status: computedStatus,
        total_copies: totalCopies,
        available_copies: availableCopies,
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

    const { title, author, genre, isbn, total_copies } = req.body;

    if (!title || !author) {
      return res.status(400).json({ message: 'Title and author are required' });
    }

    const totalCopies = Number.isFinite(Number(total_copies)) && Number(total_copies) > 0 ? Number(total_copies) : 1;
    const availableCopies = totalCopies;
    const availabilityStatus = availableCopies > 0 ? 'available' : 'checked_out';

    // Support older DBs that might not have all columns yet.
    db.all('PRAGMA table_info(books)', (pragmaErr, cols) => {
      if (pragmaErr) {
        return res.status(500).json({ message: 'Database error', error: pragmaErr.message });
      }

      const colNames = new Set(cols.map((c) => c.name));
      const has = (name) => colNames.has(name);

      const fields = ['title', 'author'];
      const params = [title, author];

      if (has('genre')) {
        fields.push('genre');
        params.push(genre ?? null);
      }
      if (has('isbn')) {
        fields.push('isbn');
        params.push(isbn ?? null);
      }
      if (has('total_copies')) {
        fields.push('total_copies');
        params.push(totalCopies);
      }
      if (has('available_copies')) {
        fields.push('available_copies');
        params.push(availableCopies);
      }
      if (has('availability_status')) {
        fields.push('availability_status');
        params.push(availabilityStatus);
      }
      if (has('created_by')) {
        fields.push('created_by');
        params.push(decoded.userId);
      }

      const placeholders = fields.map(() => '?').join(', ');
      const sql = `INSERT INTO books (${fields.join(', ')}) VALUES (${placeholders})`;

      db.run(sql, params, function(err) {
        if (err) {
          return res.status(500).json({ message: 'Failed to add book', error: err.message });
        }

        res.status(201).json({
          message: 'Book added successfully',
          book: {
            id: this.lastID,
            title,
            author,
            genre: genre ?? null,
            isbn: isbn ?? null,
            total_copies: totalCopies,
            available_copies: availableCopies,
            availability_status: availabilityStatus
          }
        });
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

        const usesCopies = typeof book.available_copies === 'number';
        if (usesCopies && book.available_copies <= 0) {
          return res.status(400).json({ message: 'No copies available' });
        }

        // Prevent a student from checking out the same book twice.
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

            // If we don't have copy counts, enforce single active checkout per book.
            const ensureSingleCopy = (cb) => {
              if (usesCopies) return cb(null);
              db.get(
                'SELECT * FROM book_checkouts WHERE book_id = ? AND status = ?',
                [bookId, 'active'],
                (e, existingCheckout) => {
                  if (e) return cb(e);
                  if (existingCheckout) return cb(new Error('Book is already checked out'));
                  return cb(null);
                }
              );
            };

            ensureSingleCopy((singleCopyErr) => {
              if (singleCopyErr) {
                const msg =
                  singleCopyErr.message === 'Book is already checked out'
                    ? singleCopyErr.message
                    : 'Database error';
                const status = singleCopyErr.message === 'Book is already checked out' ? 400 : 500;
                return res.status(status).json({ message: msg });
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

                  if (usesCopies) {
                    const newAvailable = Math.max(0, (book.available_copies || 0) - 1);
                    const newStatus = newAvailable > 0 ? 'available' : 'checked_out';
                    db.run(
                      'UPDATE books SET available_copies = ?, availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                      [newAvailable, newStatus, bookId],
                      (e) => {
                        if (e) console.error('Error updating book copies/status:', e);
                        return res.json({
                          message: 'Book checked out successfully',
                          checkout: {
                            id: this.lastID,
                            bookId,
                            userId: decoded.userId,
                            dueDate: dueDate.toISOString()
                          },
                          book: { available_copies: newAvailable, availability_status: newStatus }
                        });
                      }
                    );
                  } else {
                    // Legacy behavior: single copy tracked only by status
                    db.run(
                      'UPDATE books SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                      ['checked_out', bookId],
                      (e) => {
                        if (e) console.error('Error updating book status:', e);
                        return res.json({
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
                }
              );
            });
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

    // Get current user to determine permissions
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (userErr, user) => {
      if (userErr) {
        return res.status(500).json({ message: 'Database error', error: userErr.message });
      }
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const isStaff = user.user_type === 'staff' || user.role === 'admin' || user.user_type === 'admin';

      const checkoutSql = isStaff
        ? 'SELECT * FROM book_checkouts WHERE book_id = ? AND status = ? ORDER BY checkout_date ASC LIMIT 1'
        : 'SELECT * FROM book_checkouts WHERE book_id = ? AND user_id = ? AND status = ? ORDER BY checkout_date ASC LIMIT 1';
      const checkoutParams = isStaff ? [bookId, 'active'] : [bookId, decoded.userId, 'active'];

      db.get(checkoutSql, checkoutParams, (checkoutErr, checkout) => {
        if (checkoutErr) {
          return res.status(500).json({ message: 'Database error', error: checkoutErr.message });
        }
        if (!checkout) {
          return res.status(404).json({ message: 'No active checkout found for this book' });
        }

        // Update checkout status
        db.run(
          'UPDATE book_checkouts SET status = ?, return_date = CURRENT_TIMESTAMP WHERE id = ?',
          ['returned', checkout.id],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ message: 'Failed to return book', error: updateErr.message });
            }

            // Update book counters/status if available_copies exists
            db.get('SELECT * FROM books WHERE id = ?', [bookId], (bookErr, book) => {
              if (bookErr) {
                return res.status(500).json({ message: 'Database error', error: bookErr.message });
              }
              if (!book) {
                return res.json({ message: 'Book returned successfully' });
              }

              const usesCopies = typeof book.available_copies === 'number';
              if (usesCopies) {
                const newAvailable = (book.available_copies || 0) + 1;
                const newStatus = newAvailable > 0 ? 'available' : 'checked_out';
                db.run(
                  'UPDATE books SET available_copies = ?, availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  [newAvailable, newStatus, bookId],
                  (e) => {
                    if (e) console.error('Error updating book copies/status:', e);
                    return res.json({
                      message: 'Book returned successfully',
                      book: { available_copies: newAvailable, availability_status: newStatus }
                    });
                  }
                );
              } else {
                db.run(
                  'UPDATE books SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  ['available', bookId],
                  (e) => {
                    if (e) console.error('Error updating book status:', e);
                    return res.json({ message: 'Book returned successfully' });
                  }
                );
              }
            });
          }
        );
      });
    });
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
        SELECT id, name, email, student_id, parent_email, created_at
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

// Get all students with their active rentals (staff/admin only)
app.get('/api/students/with-rentals', (req, res) => {
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

      // Get all students with their active rentals
      const sql = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.student_id,
          u.parent_email,
          u.created_at,
          bc.id as checkout_id,
          bc.book_id,
          bc.checkout_date,
          bc.due_date,
          b.title as book_title,
          b.author as book_author,
          b.genre as book_genre
        FROM users u
        LEFT JOIN book_checkouts bc ON u.id = bc.user_id AND bc.status = 'active'
        LEFT JOIN books b ON bc.book_id = b.id
        WHERE u.user_type = 'student'
        ORDER BY u.name, bc.checkout_date DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }

        // Group rentals by student
        const studentsMap = {};
        rows.forEach(row => {
          if (!studentsMap[row.id]) {
            studentsMap[row.id] = {
              id: row.id,
              name: row.name,
              email: row.email,
              student_id: row.student_id,
              parent_email: row.parent_email,
              created_at: row.created_at,
              rented_books: []
            };
          }

          // Add rental if exists
          if (row.checkout_id) {
            studentsMap[row.id].rented_books.push({
              checkout_id: row.checkout_id,
              book_id: row.book_id,
              title: row.book_title,
              author: row.book_author,
              genre: row.book_genre,
              checkout_date: row.checkout_date,
              due_date: row.due_date
            });
          }
        });

        const students = Object.values(studentsMap);
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

