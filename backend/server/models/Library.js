import mongoose from 'mongoose';

const librarySchema = new mongoose.Schema({
  bookId: {
    type: String,
    required: true,
    unique: true
  },
  isbn: {
    type: String,
    unique: true,
    sparse: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  publisher: {
    type: String,
    trim: true
  },
  edition: {
    type: String,
    trim: true
  },
  publicationYear: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  category: {
    type: String,
    required: true,
    enum: ['textbook', 'reference', 'fiction', 'non-fiction', 'journal', 'magazine', 'digital']
  },
  subject: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    default: 'English'
  },
  pages: {
    type: Number,
    min: 1
  },
  price: {
    type: Number,
    min: 0
  },
  location: {
    shelf: String,
    rack: String,
    floor: String,
    section: String
  },
  copies: {
    total: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    available: {
      type: Number,
      required: true,
      min: 0,
      default: 1
    },
    issued: {
      type: Number,
      default: 0,
      min: 0
    },
    damaged: {
      type: Number,
      default: 0,
      min: 0
    },
    lost: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  digitalResource: {
    isDigital: {
      type: Boolean,
      default: false
    },
    url: String,
    fileSize: String,
    format: {
      type: String,
      enum: ['pdf', 'epub', 'mobi', 'doc', 'docx', 'other']
    },
    accessType: {
      type: String,
      enum: ['free', 'subscription', 'purchase'],
      default: 'free'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'archived'],
    default: 'active'
  },
  tags: [String],
  description: {
    type: String,
    trim: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Book Issue/Return Schema
const bookIssueSchema = new mongoose.Schema({
  issueId: {
    type: String,
    required: true,
    unique: true
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Library',
    required: true
  },
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  borrowerType: {
    type: String,
    enum: ['student', 'teacher', 'staff'],
    required: true
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  returnDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['issued', 'returned', 'overdue', 'lost', 'damaged'],
    default: 'issued'
  },
  renewalCount: {
    type: Number,
    default: 0,
    max: 3
  },
  renewalHistory: [{
    renewedOn: Date,
    newDueDate: Date,
    renewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  fineAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finePaid: {
    type: Boolean,
    default: false
  },
  finePaymentDate: Date,
  notes: {
    type: String,
    trim: true
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  returnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Library Settings Schema
const librarySettingsSchema = new mongoose.Schema({
  maxBooksPerStudent: {
    type: Number,
    default: 3,
    min: 1
  },
  maxBooksPerTeacher: {
    type: Number,
    default: 5,
    min: 1
  },
  issuePeriodDays: {
    type: Number,
    default: 14,
    min: 1
  },
  maxRenewals: {
    type: Number,
    default: 2,
    min: 0
  },
  finePerDay: {
    type: Number,
    default: 1,
    min: 0
  },
  maxFineAmount: {
    type: Number,
    default: 100,
    min: 0
  },
  workingDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  workingHours: {
    open: String,
    close: String
  },
  holidays: [{
    date: Date,
    description: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
librarySchema.index({ bookId: 1 });
librarySchema.index({ isbn: 1 });
librarySchema.index({ title: 1 });
librarySchema.index({ author: 1 });
librarySchema.index({ category: 1 });
librarySchema.index({ subject: 1 });
librarySchema.index({ status: 1 });
librarySchema.index({ tags: 1 });

bookIssueSchema.index({ issueId: 1 });
bookIssueSchema.index({ book: 1 });
bookIssueSchema.index({ borrower: 1 });
bookIssueSchema.index({ status: 1 });
bookIssueSchema.index({ dueDate: 1 });
bookIssueSchema.index({ issueDate: 1 });

export const Library = mongoose.model('Library', librarySchema);
export const BookIssue = mongoose.model('BookIssue', bookIssueSchema);
export const LibrarySettings = mongoose.model('LibrarySettings', librarySettingsSchema);