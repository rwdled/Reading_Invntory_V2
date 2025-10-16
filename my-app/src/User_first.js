class Book {
    constructor(title, author, year, isbn) {
        this.title = title;
        this.author = author;
        this.year = year;
        this.isbn = isbn;
    }
}

class BookCatalog {
    constructor() {
        this.books = [];
    }

    addBook(book) {
        this.books.push(book);
    }

    findBookByTitle(title) {
        return this.books.filter(book => book.title.toLowerCase().includes(title.toLowerCase()));
    }

    listBooks() {
        return this.books;
    }
}


export{Book, BookCatalog};
