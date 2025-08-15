import mongoose from 'mongoose';

const feeReminderSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  feeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fee',
    required: true
  },
  feeType: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  reminderType: {
    type: String,
    enum: ['before_due', 'on_due', 'after_due', 'final_notice'],
    required: true
  },
  reminderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  daysBefore: {
    type: Number,
    default: 0 // Negative for overdue
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'acknowledged'],
    default: 'pending'
  },
  sentDate: Date,
  sentBy: {
    type: String,
    enum: ['system', 'admin', 'teacher'],
    default: 'system'
  },
  deliveryMethod: {
    type: String,
    enum: ['email', 'sms', 'notification', 'all'],
    default: 'email'
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastAttempt: Date,
  errorMessage: String,
  acknowledgedDate: Date,
  parentContact: {
    email: String,
    phone: String,
    name: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
feeReminderSchema.index({ studentId: 1, feeId: 1 });
feeReminderSchema.index({ dueDate: 1 });
feeReminderSchema.index({ status: 1 });
feeReminderSchema.index({ reminderType: 1 });
feeReminderSchema.index({ reminderDate: 1 });

// Method to generate reminder message
feeReminderSchema.methods.generateMessage = function() {
  const studentName = this.studentName;
  const amount = this.amount.toFixed(2);
  const dueDate = this.dueDate.toLocaleDateString();
  const feeType = this.feeType.charAt(0).toUpperCase() + this.feeType.slice(1);
  
  let message = '';
  
  switch (this.reminderType) {
    case 'before_due':
      message = `Dear ${studentName},\n\nThis is a friendly reminder that your ${feeType} fee of $${amount} is due on ${dueDate}. Please ensure payment is made before the due date to avoid late fees.\n\nThank you for your attention to this matter.\n\nBest regards,\nSchool Administration`;
      break;
      
    case 'on_due':
      message = `Dear ${studentName},\n\nYour ${feeType} fee of $${amount} is due today (${dueDate}). Please make your payment as soon as possible to avoid late fees.\n\nIf you have already made the payment, please disregard this message.\n\nBest regards,\nSchool Administration`;
      break;
      
    case 'after_due':
      const overdueDays = Math.abs(this.daysBefore);
      message = `Dear ${studentName},\n\nYour ${feeType} fee of $${amount} was due on ${dueDate} and is now ${overdueDays} day(s) overdue. Please make your payment immediately to avoid additional late fees.\n\nIf you have already made the payment, please contact the finance office.\n\nBest regards,\nSchool Administration`;
      break;
      
    case 'final_notice':
      const finalOverdueDays = Math.abs(this.daysBefore);
      message = `FINAL NOTICE\n\nDear ${studentName},\n\nThis is a final notice regarding your overdue ${feeType} fee of $${amount}, which was due on ${dueDate} (${finalOverdueDays} days ago).\n\nImmediate payment is required to avoid further action. Please contact the finance office immediately.\n\nBest regards,\nSchool Administration`;
      break;
      
    default:
      message = `Dear ${studentName},\n\nPlease be reminded about your ${feeType} fee of $${amount} due on ${dueDate}.\n\nBest regards,\nSchool Administration`;
  }
  
  this.message = message;
  return message;
};

// Method to mark as sent
feeReminderSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentDate = new Date();
  this.attempts += 1;
  this.lastAttempt = new Date();
  return this.save();
};

// Method to mark as failed
feeReminderSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.attempts += 1;
  this.lastAttempt = new Date();
  this.errorMessage = errorMessage;
  return this.save();
};

// Method to acknowledge reminder
feeReminderSchema.methods.acknowledge = function() {
  this.status = 'acknowledged';
  this.acknowledgedDate = new Date();
  return this.save();
};

// Static method to create reminders for due fees
feeReminderSchema.statics.createReminders = async function(reminderType = 'before_due', daysBefore = 7) {
  const Fee = mongoose.model('Fee');
  const Student = mongoose.model('Student');
  
  let dateQuery = {};
  const today = new Date();
  const targetDate = new Date();
  
  switch (reminderType) {
    case 'before_due':
      targetDate.setDate(today.getDate() + daysBefore);
      dateQuery = {
        dueDate: {
          $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
          $lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
        }
      };
      break;
      
    case 'on_due':
      dateQuery = {
        dueDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        }
      };
      daysBefore = 0;
      break;
      
    case 'after_due':
      targetDate.setDate(today.getDate() - Math.abs(daysBefore));
      dateQuery = {
        dueDate: {
          $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
          $lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
        }
      };
      daysBefore = -Math.abs(daysBefore);
      break;
      
    case 'final_notice':
      targetDate.setDate(today.getDate() - 30); // 30 days overdue
      dateQuery = {
        dueDate: { $lt: targetDate }
      };
      daysBefore = -30;
      break;
  }
  
  // Find unpaid fees matching the criteria
  const unpaidFees = await Fee.find({
    ...dateQuery,
    status: { $in: ['pending', 'partial', 'overdue'] }
  }).populate('studentId', 'name email parentInfo');
  
  const reminders = [];
  
  for (const fee of unpaidFees) {
    // Check if reminder already exists for this fee and type
    const existingReminder = await this.findOne({
      feeId: fee._id,
      reminderType,
      status: { $in: ['sent', 'pending'] }
    });
    
    if (!existingReminder && fee.studentId) {
      const reminder = new this({
        studentId: fee.studentId._id,
        studentName: fee.studentId.name,
        studentEmail: fee.studentId.email,
        feeId: fee._id,
        feeType: fee.type,
        amount: fee.amount - fee.paidAmount,
        dueDate: fee.dueDate,
        reminderType,
        daysBefore,
        parentContact: {
          email: fee.studentId.parentInfo?.guardianEmail,
          phone: fee.studentId.parentInfo?.guardianPhone,
          name: fee.studentId.parentInfo?.guardianName
        }
      });
      
      reminder.generateMessage();
      await reminder.save();
      reminders.push(reminder);
    }
  }
  
  return reminders;
};

// Static method to send pending reminders
feeReminderSchema.statics.sendPendingReminders = async function() {
  const pendingReminders = await this.find({ status: 'pending' })
    .populate('studentId', 'name email')
    .limit(50); // Process in batches
  
  const results = {
    sent: 0,
    failed: 0,
    errors: []
  };
  
  for (const reminder of pendingReminders) {
    try {
      // Here you would integrate with your email/SMS service
      // For now, we'll just mark as sent
      await reminder.markAsSent();
      results.sent++;
    } catch (error) {
      await reminder.markAsFailed(error.message);
      results.failed++;
      results.errors.push({
        reminderId: reminder._id,
        studentName: reminder.studentName,
        error: error.message
      });
    }
  }
  
  return results;
};

export default mongoose.model('FeeReminder', feeReminderSchema);