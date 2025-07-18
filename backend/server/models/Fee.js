import mongoose from 'mongoose';

const feeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  studentClass: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['tuition', 'transport', 'library', 'lab', 'sports', 'exam', 'other'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  term: {
    type: String,
    required: true,
    default: 'Spring 2024'
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-25'
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  lateFee: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'online', 'check'],
    required: function() {
      return this.paidAmount > 0;
    }
  },
  transactionId: {
    type: String,
    trim: true
  },
  invoiceNumber: {
    type: String,
    unique: true,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  paymentHistory: [{
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    method: { type: String, required: true },
    transactionId: String,
    receivedBy: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
feeSchema.index({ studentId: 1, term: 1 });
feeSchema.index({ status: 1 });
feeSchema.index({ dueDate: 1 });
feeSchema.index({ invoiceNumber: 1 });

// Auto-generate invoice number
feeSchema.pre('save', function(next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.invoiceNumber = `INV-${year}${month}-${random}`;
  }
  
  // Update status based on payment
  const totalAmount = this.amount + this.lateFee - this.discount;
  
  if (this.paidAmount === 0) {
    this.status = new Date() > this.dueDate ? 'overdue' : 'pending';
  } else if (this.paidAmount >= totalAmount) {
    this.status = 'paid';
  } else {
    this.status = 'partial';
  }
  
  next();
});

export default mongoose.model('Fee', feeSchema);