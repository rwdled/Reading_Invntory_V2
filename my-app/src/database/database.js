const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  }

  // Initialize database connection and create tables
  async init() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, 'inventory.db');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  // Create tables from schema
  async createTables() {
    return new Promise((resolve, reject) => {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      this.db.exec(schema, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created successfully');
          this.addMissingColumns()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  // Ensure newly added columns exist (for existing DBs)
  async addMissingColumns() {
    const ensureColumn = (table, column, definition) => {
      return new Promise((resolve, reject) => {
        this.db.all(`PRAGMA table_info(${table})`, (err, rows) => {
          if (err) return reject(err);
          const exists = rows.some(r => r.name === column);
          if (exists) return resolve();
          this.db.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`, (alterErr) => {
            if (alterErr) return reject(alterErr);
            resolve();
          });
        });
      });
    };

    // Add columns to books table
    await ensureColumn('books', 'total_copies', 'INTEGER DEFAULT 1');
    await ensureColumn('books', 'available_copies', 'INTEGER DEFAULT 1');
    await ensureColumn('books', 'created_by', 'INTEGER');

    // Add notes to book_checkouts (optional metadata)
    await ensureColumn('book_checkouts', 'notes', 'TEXT');

    // Backfill availability counts and status
    await new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(
          'UPDATE books SET total_copies = 1 WHERE total_copies IS NULL',
        );
        this.db.run(
          'UPDATE books SET available_copies = total_copies WHERE available_copies IS NULL',
        );
        this.db.run(
          "UPDATE books SET availability_status = CASE WHEN available_copies > 0 THEN 'available' ELSE 'checked_out' END",
          (err) => (err ? reject(err) : resolve())
        );
      });
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }

  // User Management Methods

  // Create a new user (student or staff)
  async createUser(userData) {
    return new Promise(async (resolve, reject) => {
      try {
        const { userType, studentId, name, email, password, parentEmail, department, role } = userData;
        
        // Hash the password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        const sql = `
          INSERT INTO users (user_type, student_id, name, email, password_hash, parent_email, department, role)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(sql, [userType, studentId, name, email, passwordHash, parentEmail, department, role], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...userData });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Find user by email
  async findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
      this.db.get(sql, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Find user by student ID
  async findUserByStudentId(studentId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE student_id = ? AND is_active = 1';
      this.db.get(sql, [studentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Find user by ID
  async findUserById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user last login
  async updateLastLogin(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [userId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Session Management

  // Create a new session
  async createSession(userId) {
    return new Promise((resolve, reject) => {
      const sessionToken = jwt.sign({ userId }, this.jwtSecret, { expiresIn: '7d' });
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const sql = `
        INSERT INTO user_sessions (user_id, session_token, expires_at)
        VALUES (?, ?, ?)
      `;
      
      this.db.run(sql, [userId, sessionToken, expiresAt.toISOString()], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(sessionToken);
        }
      });
    });
  }

  // Validate session token
  async validateSession(sessionToken) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.*, s.expires_at 
        FROM users u 
        JOIN user_sessions s ON u.id = s.user_id 
        WHERE s.session_token = ? AND s.expires_at > datetime('now')
      `;
      
      this.db.get(sql, [sessionToken], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Delete session (logout)
  async deleteSession(sessionToken) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM user_sessions WHERE session_token = ?';
      this.db.run(sql, [sessionToken], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Clean expired sessions
  async cleanExpiredSessions() {
    return new Promise((resolve, reject) => {
      const sql = "DELETE FROM user_sessions WHERE expires_at <= datetime('now')";
      this.db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Get all users (for admin)
  async getAllUsers() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, user_type, student_id, name, email, department, role, created_at, last_login FROM users WHERE is_active = 1';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Update user
  async updateUser(userId, updateData) {
    return new Promise(async (resolve, reject) => {
      try {
        const fields = [];
        const values = [];
        
        if (updateData.name) {
          fields.push('name = ?');
          values.push(updateData.name);
        }
        if (updateData.email) {
          fields.push('email = ?');
          values.push(updateData.email);
        }
        if (updateData.department) {
          fields.push('department = ?');
          values.push(updateData.department);
        }
        if (updateData.role) {
          fields.push('role = ?');
          values.push(updateData.role);
        }
        if (updateData.password) {
          const passwordHash = await bcrypt.hash(updateData.password, 12);
          fields.push('password_hash = ?');
          values.push(passwordHash);
        }
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);
        
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        
        this.db.run(sql, values, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Deactivate user (soft delete)
  async deactivateUser(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [userId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Book & Rental management
  // ---------------------------------------------------------------------------

  // Get all books with availability and current active checkout (if any)
  async getAllBooks(currentUser = null) {
    return new Promise((resolve, reject) => {
      const currentUserId = currentUser?.id || null;
      const isStaff = currentUser && (currentUser.user_type === 'staff' || currentUser.role === 'admin' || currentUser.user_type === 'admin');

      const sql = `
        SELECT 
          b.*,
          bc.id AS checkout_id,
          bc.user_id AS checkout_user_id,
          bc.checkout_date AS checkout_date,
          bc.due_date AS checkout_due_date,
          u.name AS checkout_student_name,
          u.student_id AS checkout_student_id,
          u.email AS checkout_student_email
        FROM books b
        LEFT JOIN book_checkouts bc 
          ON bc.book_id = b.id AND bc.status = 'active'
        LEFT JOIN users u 
          ON u.id = bc.user_id
        GROUP BY b.id
        ORDER BY b.title COLLATE NOCASE ASC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        const books = rows.map((row) => {
          const availabilityStatus = row.available_copies > 0 ? 'available' : 'checked_out';
          const checkout = row.checkout_id
            ? {
                id: row.checkout_id,
                user_id: row.checkout_user_id,
                student_name: row.checkout_student_name,
                student_id: row.checkout_student_id,
                student_email: row.checkout_student_email,
                checkout_date: row.checkout_date,
                due_date: row.checkout_due_date
              }
            : null;

          // Only surface checkout to students if it's theirs; staff can see all
          const includeCheckout =
            checkout &&
            (isStaff || currentUserId === null || checkout.user_id === currentUserId);

          return {
            id: row.id,
            title: row.title,
            author: row.author,
            genre: row.genre,
            isbn: row.isbn,
            total_copies: row.total_copies,
            available_copies: row.available_copies,
            availability_status: availabilityStatus,
            checkout: includeCheckout ? checkout : null
          };
        });
        resolve(books);
      });
    });
  }

  // Get single book with availability
  async getBookById(bookId, currentUser = null) {
    const books = await this.getAllBooks(currentUser);
    return books.find((b) => b.id === Number(bookId)) || null;
  }

  // Add a new book (staff/admin)
  async addBook(bookData) {
    const { title, author, genre = null, isbn = null, total_copies = 1, created_by = null } = bookData;
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO books (title, author, genre, isbn, total_copies, available_copies, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.run(
        sql,
        [title, author, genre, isbn, total_copies, total_copies, created_by],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            title,
            author,
            genre,
            isbn,
            total_copies,
            available_copies: total_copies,
            availability_status: total_copies > 0 ? 'available' : 'checked_out'
          });
        }
      );
    });
  }

  // Checkout a book (student)
  async checkoutBook(bookId, userId, options = {}) {
    const loanDays = options.loanDays || 14;
    const dueDate = new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, book) => {
          if (err) return reject(err);
          if (!book) return reject(new Error('Book not found'));
          if (book.available_copies <= 0) return reject(new Error('No copies available'));

          // Start transaction
          this.db.run('BEGIN IMMEDIATE TRANSACTION');

          this.db.run(
            `INSERT INTO book_checkouts (user_id, book_id, due_date, status) VALUES (?, ?, ?, 'active')`,
            [userId, bookId, dueDate.toISOString()],
            function (insertErr) {
              if (insertErr) {
                this.db.run('ROLLBACK');
                return reject(insertErr);
              }

              const checkoutId = this.lastID;

              const newAvailable = book.available_copies - 1;
              const newStatus = newAvailable > 0 ? 'available' : 'checked_out';

              this.db.run(
                `UPDATE books 
                 SET available_copies = ?, availability_status = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [newAvailable, newStatus, bookId],
                (updateErr) => {
                  if (updateErr) {
                    this.db.run('ROLLBACK');
                    return reject(updateErr);
                  }

                  this.db.run('COMMIT', (commitErr) => {
                    if (commitErr) return reject(commitErr);
                    resolve({
                      checkoutId,
                      dueDate,
                      available_copies: newAvailable,
                      availability_status: newStatus
                    });
                  });
                }
              );
            }.bind(this)
          );
        });
      });
    });
  }

  // Return a book
  async returnBook(bookId, userId, isStaff = false) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Find an active checkout
        const checkoutSql = isStaff
          ? `SELECT * FROM book_checkouts WHERE book_id = ? AND status = 'active' ORDER BY checkout_date ASC LIMIT 1`
          : `SELECT * FROM book_checkouts WHERE book_id = ? AND user_id = ? AND status = 'active' ORDER BY checkout_date ASC LIMIT 1`;

        const checkoutParams = isStaff ? [bookId] : [bookId, userId];

        this.db.get(checkoutSql, checkoutParams, (err, checkout) => {
          if (err) return reject(err);
          if (!checkout) return reject(new Error('No active checkout found for this book'));

          this.db.run('BEGIN IMMEDIATE TRANSACTION');

          this.db.run(
            `UPDATE book_checkouts 
             SET status = 'returned', return_date = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [checkout.id],
            (updateCheckoutErr) => {
              if (updateCheckoutErr) {
                this.db.run('ROLLBACK');
                return reject(updateCheckoutErr);
              }

              this.db.get('SELECT available_copies FROM books WHERE id = ?', [bookId], (bookErr, bookRow) => {
                if (bookErr) {
                  this.db.run('ROLLBACK');
                  return reject(bookErr);
                }

                const newAvailable = (bookRow?.available_copies || 0) + 1;

                this.db.run(
                  `UPDATE books 
                   SET available_copies = ?, availability_status = 'available', updated_at = CURRENT_TIMESTAMP 
                   WHERE id = ?`,
                  [newAvailable, bookId],
                  (updateBookErr) => {
                    if (updateBookErr) {
                      this.db.run('ROLLBACK');
                      return reject(updateBookErr);
                    }

                    this.db.run('COMMIT', (commitErr) => {
                      if (commitErr) return reject(commitErr);
                      resolve({
                        available_copies: newAvailable,
                        availability_status: 'available'
                      });
                    });
                  }
                );
              });
            }
          );
        });
      });
    });
  }

  // Get all rentals (staff/admin)
  async getAllRentals() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          bc.id,
          bc.book_id,
          bc.user_id,
          bc.checkout_date,
          bc.due_date,
          bc.return_date,
          bc.status,
          b.title,
          b.author,
          b.genre,
          u.name AS student_name,
          u.student_id,
          u.email AS student_email
        FROM book_checkouts bc
        JOIN books b ON b.id = bc.book_id
        JOIN users u ON u.id = bc.user_id
        ORDER BY bc.checkout_date DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  // Get all students (staff/admin)
  async getAllStudentsWithCounts() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.student_id,
          u.parent_email,
          u.created_at,
          SUM(CASE WHEN bc.status = 'active' THEN 1 ELSE 0 END) AS active_rentals
        FROM users u
        LEFT JOIN book_checkouts bc ON u.id = bc.user_id
        WHERE u.user_type = 'student' AND u.is_active = 1
        GROUP BY u.id
        ORDER BY u.name COLLATE NOCASE ASC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  // Get students with their active rentals (teacher view)
  async getStudentsWithRentals() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.student_id,
          u.parent_email,
          bc.id AS checkout_id,
          bc.book_id,
          bc.due_date,
          b.title,
          b.author,
          b.genre
        FROM users u
        LEFT JOIN book_checkouts bc ON u.id = bc.user_id AND bc.status = 'active'
        LEFT JOIN books b ON b.id = bc.book_id
        WHERE u.user_type = 'student' AND u.is_active = 1
        ORDER BY u.name COLLATE NOCASE ASC, bc.checkout_date DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) return reject(err);

        const byStudent = {};
        rows.forEach((row) => {
          if (!byStudent[row.id]) {
            byStudent[row.id] = {
              id: row.id,
              name: row.name,
              email: row.email,
              student_id: row.student_id,
              parent_email: row.parent_email,
              rented_books: []
            };
          }
          if (row.checkout_id) {
            byStudent[row.id].rented_books.push({
              checkout_id: row.checkout_id,
              book_id: row.book_id,
              title: row.title,
              author: row.author,
              genre: row.genre,
              due_date: row.due_date
            });
          }
        });

        resolve(Object.values(byStudent));
      });
    });
  }
}

module.exports = Database;
