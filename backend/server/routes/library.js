import express from 'express';
import { body, validationResult } from 'express-validator';
import { Library, BookIssue, LibrarySettings } from '../models/Library.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import User from '../models/User.js';
import { generateId } from '../utils/helpers.js';

const router = express.Router();

// Validation middleware
const validateBook = [
  body('title').trim().isLength({ min: 2 }).withMessage('Title must be at least 2 characters'),
  body('author').trim().isLength({ min: 2 }).withMessage('Author must be at least 2 characters'),
  body('category').isIn(['textbook', 'reference', 'fiction', 'non-fiction', 'journal', 'magazine', 'digital']).withMessage('Valid category is required'),
  body('copies.total').isInt({ min: 1 }).withMessage('Total copies must be at least 1')
];

const validateBookIssue = [
  body('book').isMongoId().withMessage('Valid book ID is required'),
  body('borrower').isMongoId().withMessage('Valid borrower ID is required'),
  body('borrowerType').isIn(['student', 'teacher', 'staff']).withMessage('Valid borrower type is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required')
];

// BOOK MANAGEMENT ROUTES

// Get all books with filtering and pagination
router.get('/books', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { author: { $regex: req.query.search, $options: 'i' } },
        { isbn: { $regex: req.query.search, $options: 'i' } },
        { bookId: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.subject) {
      filter.subject = { $regex: req.query.subject, $options: 'i' };
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.availability === 'available') {
      filter['copies.available'] = { $gt: 0 };
    } else if (req.query.availability === 'unavailable') {
      filter['copies.available'] = 0;
    }

    const books = await Library.find(filter)
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Library.countDocuments(filter);

    res.json({
      success: true,
      data: books,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching books',
      error: error.message
    });
  }
});

// Get book by ID
router.get('/books/:id', async (req, res) => {
  try {
    const book = await Library.findById(req.params.id)
      .populate('addedBy', 'name email');

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Get current issues for this book
    const currentIssues = await BookIssue.find({
      book: req.params.id,
      status: { $in: ['issued', 'overdue'] }
    })
    .populate('borrower', 'name email')
    .populate('issuedBy', 'name');

    res.json({
      success: true,
      data: {
        ...book.toObject(),
        currentIssues
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching book',
      error: error.message
    });
  }
});

// Add new book
router.post('/books', validateBook, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if ISBN already exists (if provided)
    if (req.body.isbn) {
      const existingBook = await Library.findOne({ isbn: req.body.isbn });
      if (existingBook) {
        return res.status(400).json({
          success: false,
          message: 'Book with this ISBN already exists'
        });
      }
    }

    const bookData = {
      ...req.body,
      bookId: generateId('BK'),
      copies: {
        ...req.body.copies,
        available: req.body.copies.total,
        issued: 0,
        damaged: 0,
        lost: 0
      },
      addedBy: req.user.id
    };

    const book = new Library(bookData);
    await book.save();

    await book.populate('addedBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Book added successfully',
      data: book
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding book',
      error: error.message
    });
  }
});

// Update book
router.put('/books/:id', validateBook, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const book = await Library.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Check for duplicate ISBN (excluding current book)
    if (req.body.isbn && req.body.isbn !== book.isbn) {
      const existingBook = await Library.findOne({
        _id: { $ne: req.params.id },
        isbn: req.body.isbn
      });

      if (existingBook) {
        return res.status(400).json({
          success: false,
          message: 'Book with this ISBN already exists'
        });
      }
    }

    // Update book
    Object.assign(book, req.body);
    await book.save();

    await book.populate('addedBy', 'name');

    res.json({
      success: true,
      message: 'Book updated successfully',
      data: book
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating book',
      error: error.message
    });
  }
});

// Delete book
router.delete('/books/:id', async (req, res) => {
  try {
    const book = await Library.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Check if book has active issues
    const activeIssues = await BookIssue.countDocuments({
      book: req.params.id,
      status: { $in: ['issued', 'overdue'] }
    });

    if (activeIssues > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete book with active issues'
      });
    }

    book.status = 'archived';
    await book.save();

    res.json({
      success: true,
      message: 'Book archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting book',
      error: error.message
    });
  }
});

// BOOK ISSUE/RETURN ROUTES

// Get all book issues with filtering
router.get('/issues', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.borrowerType) {
      filter.borrowerType = req.query.borrowerType;
    }
    
    if (req.query.overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $in: ['issued', 'overdue'] };
    }

    const issues = await BookIssue.find(filter)
      .populate('book', 'title author bookId isbn')
      .populate('borrower', 'name email')
      .populate('issuedBy', 'name')
      .populate('returnedBy', 'name')
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await BookIssue.countDocuments(filter);

    res.json({
      success: true,
      data: issues,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching book issues',
      error: error.message
    });
  }
});

// Issue book
router.post('/issue', validateBookIssue, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { book: bookId, borrower: borrowerId, borrowerType, dueDate } = req.body;

    // Check if book exists and is available
    const book = await Library.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    if (book.copies.available <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Book is not available for issue'
      });
    }

    // Check if borrower exists
    const borrower = await User.findById(borrowerId);
    if (!borrower) {
      return res.status(404).json({
        success: false,
        message: 'Borrower not found'
      });
    }

    // Get library settings
    let settings = await LibrarySettings.findOne();
    if (!settings) {
      settings = new LibrarySettings();
      await settings.save();
    }

    // Check borrowing limits
    const activeIssues = await BookIssue.countDocuments({
      borrower: borrowerId,
      status: { $in: ['issued', 'overdue'] }
    });

    const maxBooks = borrowerType === 'student' ? settings.maxBooksPerStudent : settings.maxBooksPerTeacher;
    
    if (activeIssues >= maxBooks) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${maxBooks} books can be issued to a ${borrowerType}`
      });
    }

    // Check if borrower already has this book
    const existingIssue = await BookIssue.findOne({
      book: bookId,
      borrower: borrowerId,
      status: { $in: ['issued', 'overdue'] }
    });

    if (existingIssue) {
      return res.status(400).json({
        success: false,
        message: 'This book is already issued to the borrower'
      });
    }

    // Create book issue
    const issueData = {
      issueId: generateId('ISS'),
      book: bookId,
      borrower: borrowerId,
      borrowerType,
      dueDate: new Date(dueDate),
      issuedBy: req.user.id
    };

    const bookIssue = new BookIssue(issueData);
    await bookIssue.save();

    // Update book availability
    book.copies.available -= 1;
    book.copies.issued += 1;
    await book.save();

    await bookIssue.populate('book', 'title author bookId');
    await bookIssue.populate('borrower', 'name email');
    await bookIssue.populate('issuedBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Book issued successfully',
      data: bookIssue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error issuing book',
      error: error.message
    });
  }
});

// Return book
router.post('/return/:issueId', async (req, res) => {
  try {
    const bookIssue = await BookIssue.findOne({ issueId: req.params.issueId })
      .populate('book')
      .populate('borrower', 'name email');

    if (!bookIssue) {
      return res.status(404).json({
        success: false,
        message: 'Book issue not found'
      });
    }

    if (bookIssue.status === 'returned') {
      return res.status(400).json({
        success: false,
        message: 'Book is already returned'
      });
    }

    // Calculate fine if overdue
    const returnDate = new Date();
    let fineAmount = 0;
    
    if (returnDate > bookIssue.dueDate) {
      const settings = await LibrarySettings.findOne() || new LibrarySettings();
      const overdueDays = Math.ceil((returnDate - bookIssue.dueDate) / (1000 * 60 * 60 * 24));
      fineAmount = Math.min(overdueDays * settings.finePerDay, settings.maxFineAmount);
    }

    // Update book issue
    bookIssue.returnDate = returnDate;
    bookIssue.status = 'returned';
    bookIssue.fineAmount = fineAmount;
    bookIssue.returnedBy = req.user.id;
    bookIssue.notes = req.body.notes || '';

    await bookIssue.save();

    // Update book availability
    const book = await Library.findById(bookIssue.book._id);
    book.copies.available += 1;
    book.copies.issued -= 1;
    await book.save();

    await bookIssue.populate('returnedBy', 'name');

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: bookIssue,
      fine: fineAmount > 0 ? {
        amount: fineAmount,
        message: `Fine of $${fineAmount} is applicable for late return`
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error returning book',
      error: error.message
    });
  }
});

// Renew book
router.post('/renew/:issueId', async (req, res) => {
  try {
    const bookIssue = await BookIssue.findOne({ issueId: req.params.issueId })
      .populate('book', 'title author');

    if (!bookIssue) {
      return res.status(404).json({
        success: false,
        message: 'Book issue not found'
      });
    }

    if (bookIssue.status !== 'issued') {
      return res.status(400).json({
        success: false,
        message: 'Only issued books can be renewed'
      });
    }

    const settings = await LibrarySettings.findOne() || new LibrarySettings();
    
    if (bookIssue.renewalCount >= settings.maxRenewals) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${settings.maxRenewals} renewals allowed`
      });
    }

    // Check if book is overdue
    if (new Date() > bookIssue.dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Overdue books cannot be renewed'
      });
    }

    // Renew book
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + settings.issuePeriodDays);

    bookIssue.renewalHistory.push({
      renewedOn: new Date(),
      newDueDate,
      renewedBy: req.user.id
    });

    bookIssue.dueDate = newDueDate;
    bookIssue.renewalCount += 1;

    await bookIssue.save();

    res.json({
      success: true,
      message: 'Book renewed successfully',
      data: {
        issueId: bookIssue.issueId,
        newDueDate,
        renewalCount: bookIssue.renewalCount,
        remainingRenewals: settings.maxRenewals - bookIssue.renewalCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error renewing book',
      error: error.message
    });
  }
});

// Get overdue books
router.get('/overdue', async (req, res) => {
  try {
    const overdueIssues = await BookIssue.find({
      dueDate: { $lt: new Date() },
      status: { $in: ['issued', 'overdue'] }
    })
    .populate('book', 'title author bookId')
    .populate('borrower', 'name email phone')
    .sort({ dueDate: 1 });

    // Update status to overdue
    await BookIssue.updateMany(
      {
        dueDate: { $lt: new Date() },
        status: 'issued'
      },
      { status: 'overdue' }
    );

    res.json({
      success: true,
      data: overdueIssues
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching overdue books',
      error: error.message
    });
  }
});

// LIBRARY SETTINGS ROUTES

// Get library settings
router.get('/settings', async (req, res) => {
  try {
    let settings = await LibrarySettings.findOne();
    if (!settings) {
      settings = new LibrarySettings();
      await settings.save();
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching library settings',
      error: error.message
    });
  }
});

// Update library settings
router.put('/settings', async (req, res) => {
  try {
    let settings = await LibrarySettings.findOne();
    if (!settings) {
      settings = new LibrarySettings();
    }

    Object.assign(settings, req.body);
    await settings.save();

    res.json({
      success: true,
      message: 'Library settings updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating library settings',
      error: error.message
    });
  }
});

// REPORTS AND ANALYTICS

// Get library statistics
router.get('/statistics', async (req, res) => {
  try {
    const totalBooks = await Library.countDocuments({ status: 'active' });
    const availableBooks = await Library.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$copies.available' } } }
    ]);

    const issuedBooks = await BookIssue.countDocuments({ 
      status: { $in: ['issued', 'overdue'] } 
    });

    const overdueBooks = await BookIssue.countDocuments({ 
      status: 'overdue' 
    });

    const categoryStats = await Library.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const monthlyIssues = await BookIssue.aggregate([
      {
        $match: {
          issueDate: { $gte: new Date(new Date().getFullYear(), 0, 1) }
        }
      },
      {
        $group: {
          _id: { $month: '$issueDate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalBooks,
        availableBooks: availableBooks[0]?.total || 0,
        issuedBooks,
        overdueBooks,
        categoryStats,
        monthlyIssues
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching library statistics',
      error: error.message
    });
  }
});

export default router;