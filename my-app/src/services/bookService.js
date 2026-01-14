import { API_BASE_URL } from '../config/api';

// Book service for managing book operations
class BookService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('sessionToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Get all books
  async getAllBooks() {
    try {
      const response = await fetch(`${this.baseURL}/api/books`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const books = await response.json();
        return { success: true, books };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to fetch books' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Get book by ID
  async getBookById(bookId) {
    try {
      const response = await fetch(`${this.baseURL}/api/books/${bookId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const book = await response.json();
        return { success: true, book };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to fetch book' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Add a new book (requires authentication)
  async addBook(bookData) {
    try {
      const response = await fetch(`${this.baseURL}/api/books`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(bookData)
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, book: data.book };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to add book' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Import books from Google Sheets (requires staff authentication)
  async importFromGoogleSheets(spreadsheetId, sheetName = null, apiKey = null) {
    try {
      const response = await fetch(`${this.baseURL}/api/books/import-sheets`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          spreadsheetId,
          sheetName,
          apiKey
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, ...data };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to import books' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Import books from CSV file (requires staff authentication)
  async importFromCsv(file) {
    try {
      const token = localStorage.getItem('sessionToken');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseURL}/api/books/import-csv`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, ...data };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to import books' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Get all students (staff/admin only)
  async getAllStudents() {
    try {
      const response = await fetch(`${this.baseURL}/api/students`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, count: data.count, students: data.students };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to fetch students' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Checkout a book (student action)
  async checkoutBook(bookId) {
    try {
      const response = await fetch(`${this.baseURL}/api/books/${bookId}/checkout`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, ...data };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to checkout book' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Return a book
  async returnBook(bookId) {
    try {
      const response = await fetch(`${this.baseURL}/api/books/${bookId}/return`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, ...data };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to return book' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Get all rentals (staff/admin only)
  async getAllRentals() {
    try {
      const response = await fetch(`${this.baseURL}/api/rentals`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        const rentals = await response.json();
        return { success: true, rentals };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to fetch rentals' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }
}

// Create singleton instance
const bookService = new BookService();

export default bookService;

