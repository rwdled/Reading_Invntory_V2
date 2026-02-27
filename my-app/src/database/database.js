const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.pool = null;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  }

  // Initialize database connection and create tables
  async init() {
    try {
      this.pool = await mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      console.log('Connected to MySQL database');
      await this.createTables();
    } catch (err) {
      console.error('Error connecting to MySQL database:', err);
      throw err;
    }
  }

  // Create tables from schema
  async createTables() {
    const schemaPath = path.join(__dirname, 'schema.mysql.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split on semicolons to execute individual statements
    const statements = schema
      .split(/;[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const sql of statements) {
      try {
        // Some MySQL clients don't support IF NOT EXISTS on indexes; ignore those errors
        await this.pool.query(sql);
      } catch (err) {
        console.error('Schema statement failed:', sql, err.message);
        throw err;
      }
    }

    console.log('MySQL database tables ensured successfully');
    // For a fresh MySQL deployment we don't need dynamic column add logic.
  }

  // Ensure newly added columns exist (for existing DBs)
  async addMissingColumns() {
    // No-op for MySQL fresh schema; left here for potential future migrations.
    return;
  }

  // Close database connection
  close() {
    if (this.pool) {
      this.pool.end().catch((err) => {
        console.error('Error closing database pool:', err);
      });
    }
  }

  // User Management Methods

  // Create a new user (student or staff)
  async createUser(userData) {
    const { userType, studentId, name, email, password, parentEmail, department, role } = userData;

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const sql = `
      INSERT INTO users (user_type, student_id, name, email, password_hash, parent_email, department, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await this.pool.execute(sql, [
      userType,
      studentId,
      name,
      email,
      passwordHash,
      parentEmail,
      department,
      role
    ]);

    return { id: result.insertId, ...userData };
  }

  // Find user by email
  async findUserByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
    const [rows] = await this.pool.query(sql, [email]);
    return rows[0] || null;
  }

  // Find user by student ID
  async findUserByStudentId(studentId) {
    const sql = 'SELECT * FROM users WHERE student_id = ? AND is_active = 1';
    const [rows] = await this.pool.query(sql, [studentId]);
    return rows[0] || null;
  }

  // Find user by ID
  async findUserById(id) {
    const sql = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
    const [rows] = await this.pool.query(sql, [id]);
    return rows[0] || null;
  }

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user last login
  async updateLastLogin(userId) {
    const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
    await this.pool.execute(sql, [userId]);
  }

  // Session Management

  // Create a new session
  async createSession(userId) {
    const sessionToken = jwt.sign({ userId }, this.jwtSecret, { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const sql = `
      INSERT INTO user_sessions (user_id, session_token, expires_at)
      VALUES (?, ?, ?)
    `;

    await this.pool.execute(sql, [userId, sessionToken, expiresAt]);
    return sessionToken;
  }

  // Validate session token
  async validateSession(sessionToken) {
    const sql = `
      SELECT u.*, s.expires_at 
      FROM users u 
      JOIN user_sessions s ON u.id = s.user_id 
      WHERE s.session_token = ? AND s.expires_at > NOW()
    `;

    const [rows] = await this.pool.query(sql, [sessionToken]);
    return rows[0] || null;
  }

  // Delete session (logout)
  async deleteSession(sessionToken) {
    const sql = 'DELETE FROM user_sessions WHERE session_token = ?';
    await this.pool.execute(sql, [sessionToken]);
  }

  // Clean expired sessions
  async cleanExpiredSessions() {
    const sql = 'DELETE FROM user_sessions WHERE expires_at <= NOW()';
    await this.pool.execute(sql);
  }

  // Get all users (for admin)
  async getAllUsers() {
    const sql =
      'SELECT id, user_type, student_id, name, email, department, role, created_at, last_login FROM users WHERE is_active = 1';
    const [rows] = await this.pool.query(sql);
    return rows;
  }

  // Update user
  async updateUser(userId, updateData) {
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

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = NOW()');
    values.push(userId);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await this.pool.execute(sql, values);
  }

  // Deactivate user (soft delete)
  async deactivateUser(userId) {
    const sql = 'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?';
    await this.pool.execute(sql, [userId]);
  }

  // ---------------------------------------------------------------------------
  // Book & Rental management
  // ---------------------------------------------------------------------------

  // Get all books with availability and current active checkout (if any)
  async getAllBooks(currentUser = null) {
    const currentUserId = currentUser?.id || null;
    const isStaff =
      currentUser &&
      (currentUser.user_type === 'staff' ||
        currentUser.role === 'admin' ||
        currentUser.user_type === 'admin');

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
      ORDER BY b.title ASC
    `;

    const [rows] = await this.pool.query(sql);

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

    return books;
  }

  // Get single book with availability
  async getBookById(bookId, currentUser = null) {
    const books = await this.getAllBooks(currentUser);
    return books.find((b) => b.id === Number(bookId)) || null;
  }

  // Add a new book (staff/admin)
  async addBook(bookData) {
    const { title, author, genre = null, isbn = null, total_copies = 1, created_by = null } = bookData;
    const sql = `
      INSERT INTO books (title, author, genre, isbn, total_copies, available_copies, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await this.pool.execute(sql, [
      title,
      author,
      genre,
      isbn,
      total_copies,
      total_copies,
      created_by
    ]);

    return {
      id: result.insertId,
      title,
      author,
      genre,
      isbn,
      total_copies,
      available_copies: total_copies,
      availability_status: total_copies > 0 ? 'available' : 'checked_out'
    };
  }

  // Checkout a book (student)
  async checkoutBook(bookId, userId, options = {}) {
    const loanDays = options.loanDays || 14;
    const dueDate = new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000);

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const [bookRows] = await connection.query('SELECT * FROM books WHERE id = ?', [bookId]);
      const book = bookRows[0];
      if (!book) {
        throw new Error('Book not found');
      }
      if (book.available_copies <= 0) {
        throw new Error('No copies available');
      }

      const [insertResult] = await connection.execute(
        `INSERT INTO book_checkouts (user_id, book_id, due_date, status) VALUES (?, ?, ?, 'active')`,
        [userId, bookId, dueDate]
      );

      const checkoutId = insertResult.insertId;
      const newAvailable = book.available_copies - 1;
      const newStatus = newAvailable > 0 ? 'available' : 'checked_out';

      await connection.execute(
        `UPDATE books 
         SET available_copies = ?, availability_status = ?, updated_at = NOW() 
         WHERE id = ?`,
        [newAvailable, newStatus, bookId]
      );

      await connection.commit();

      return {
        checkoutId,
        dueDate,
        available_copies: newAvailable,
        availability_status: newStatus
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  // Return a book
  async returnBook(bookId, userId, isStaff = false) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const checkoutSql = isStaff
        ? `SELECT * FROM book_checkouts WHERE book_id = ? AND status = 'active' ORDER BY checkout_date ASC LIMIT 1`
        : `SELECT * FROM book_checkouts WHERE book_id = ? AND user_id = ? AND status = 'active' ORDER BY checkout_date ASC LIMIT 1`;

      const checkoutParams = isStaff ? [bookId] : [bookId, userId];

      const [checkoutRows] = await connection.query(checkoutSql, checkoutParams);
      const checkout = checkoutRows[0];

      if (!checkout) {
        throw new Error('No active checkout found for this book');
      }

      await connection.execute(
        `UPDATE book_checkouts 
         SET status = 'returned', return_date = NOW() 
         WHERE id = ?`,
        [checkout.id]
      );

      const [bookRows] = await connection.query(
        'SELECT available_copies FROM books WHERE id = ?',
        [bookId]
      );
      const bookRow = bookRows[0];
      const newAvailable = (bookRow?.available_copies || 0) + 1;

      await connection.execute(
        `UPDATE books 
         SET available_copies = ?, availability_status = 'available', updated_at = NOW() 
         WHERE id = ?`,
        [newAvailable, bookId]
      );

      await connection.commit();

      return {
        available_copies: newAvailable,
        availability_status: 'available'
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  // Get all rentals (staff/admin)
  async getAllRentals() {
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

    const [rows] = await this.pool.query(sql);
    return rows;
  }

  // Get all students (staff/admin)
  async getAllStudentsWithCounts() {
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
      ORDER BY u.name ASC
    `;

    const [rows] = await this.pool.query(sql);
    return rows;
  }

  // Get students with their active rentals (teacher view)
  async getStudentsWithRentals() {
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
        b.genre,
        bc.checkout_date
      FROM users u
      LEFT JOIN book_checkouts bc ON u.id = bc.user_id AND bc.status = 'active'
      LEFT JOIN books b ON b.id = bc.book_id
      WHERE u.user_type = 'student' AND u.is_active = 1
      ORDER BY u.name ASC, bc.checkout_date DESC
    `;

    const [rows] = await this.pool.query(sql);

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

    return Object.values(byStudent);
  }
}

module.exports = Database;
