import express from 'express';
import FeeReminder from '../models/FeeReminder.js';
import Fee from '../models/Fee.js';
import Student from '../models/Student.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/fee-reminders
// @desc    Get all fee reminders with filtering
// @access  Private (Admin, Teacher)
router.get('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      reminderType,
      studentId
    } = req.query;

    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (reminderType && reminderType !== 'all') {
      query.reminderType = reminderType;
    }
    
    if (studentId) {
      query.studentId = studentId;
    }
    
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { studentEmail: { $regex: search, $options: 'i' } },
        { feeType: { $regex: search, $options: 'i' } }
      ];
    }

    const reminders = await FeeReminder.find(query)
      .populate('studentId', 'name studentId email class section')
      .populate('feeId', 'type amount paidAmount dueDate status')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await FeeReminder.countDocuments(query);

    res.json({
      success: true,
      data: {
        reminders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReminders: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee reminders',
      error: error.message
    });
  }
});

// @route   POST /api/fee-reminders/create
// @desc    Create fee reminders for due payments
// @access  Private (Admin)
router.post('/create', authorize('admin'), async (req, res) => {
  try {
    const { 
      reminderType = 'before_due', 
      daysBefore = 7,
      studentIds = [],
      feeTypes = []
    } = req.body;

    let reminders = [];

    if (studentIds.length > 0) {
      // Create reminders for specific students
      for (const studentId of studentIds) {
        const student = await Student.findById(studentId);
        if (!student) continue;

        let feeQuery = {
          studentId,
          status: { $in: ['pending', 'partial', 'overdue'] }
        };

        if (feeTypes.length > 0) {
          feeQuery.type = { $in: feeTypes };
        }

        const fees = await Fee.find(feeQuery);

        for (const fee of fees) {
          const existingReminder = await FeeReminder.findOne({
            feeId: fee._id,
            reminderType,
            status: { $in: ['sent', 'pending'] }
          });

          if (!existingReminder) {
            const reminder = new FeeReminder({
              studentId: fee.studentId,
              studentName: student.name,
              studentEmail: student.email,
              feeId: fee._id,
              feeType: fee.type,
              amount: fee.amount - fee.paidAmount,
              dueDate: fee.dueDate,
              reminderType,
              daysBefore: reminderType === 'after_due' ? -Math.abs(daysBefore) : daysBefore,
              parentContact: {
                email: student.parentInfo?.guardianEmail,
                phone: student.parentInfo?.guardianPhone,
                name: student.parentInfo?.guardianName
              }
            });

            reminder.generateMessage();
            await reminder.save();
            reminders.push(reminder);
          }
        }
      }
    } else {
      // Create reminders using the static method
      reminders = await FeeReminder.createReminders(reminderType, daysBefore);
    }

    res.json({
      success: true,
      message: `${reminders.length} fee reminders created successfully`,
      data: {
        reminders,
        count: reminders.length,
        reminderType,
        daysBefore
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create fee reminders',
      error: error.message
    });
  }
});

// @route   POST /api/fee-reminders/send
// @desc    Send pending fee reminders
// @access  Private (Admin)
router.post('/send', authorize('admin'), async (req, res) => {
  try {
    const { reminderIds = [] } = req.body;

    let results;

    if (reminderIds.length > 0) {
      // Send specific reminders
      results = { sent: 0, failed: 0, errors: [] };
      
      for (const reminderId of reminderIds) {
        try {
          const reminder = await FeeReminder.findById(reminderId);
          if (reminder && reminder.status === 'pending') {
            await reminder.markAsSent();
            results.sent++;
          }
        } catch (error) {
          const reminder = await FeeReminder.findById(reminderId);
          if (reminder) {
            await reminder.markAsFailed(error.message);
            results.failed++;
            results.errors.push({
              reminderId,
              studentName: reminder.studentName,
              error: error.message
            });
          }
        }
      }
    } else {
      // Send all pending reminders
      results = await FeeReminder.sendPendingReminders();
    }

    res.json({
      success: true,
      message: 'Fee reminders processed',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send fee reminders',
      error: error.message
    });
  }
});

// @route   POST /api/fee-reminders/:id/acknowledge
// @desc    Acknowledge a fee reminder
// @access  Private
router.post('/:id/acknowledge', authorize('admin', 'teacher', 'student'), async (req, res) => {
  try {
    const reminder = await FeeReminder.findById(req.params.id);
    
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Fee reminder not found'
      });
    }

    // Students can only acknowledge their own reminders
    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student || reminder.studentId.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    await reminder.acknowledge();

    res.json({
      success: true,
      message: 'Fee reminder acknowledged',
      data: { reminder }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge fee reminder',
      error: error.message
    });
  }
});

// @route   GET /api/fee-reminders/student/me
// @desc    Get fee reminders for current student
// @access  Private (Student)
router.get('/student/me', authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const reminders = await FeeReminder.find({ studentId: student._id })
      .populate('feeId', 'type amount paidAmount dueDate status')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { reminders }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fee reminders',
      error: error.message
    });
  }
});

// @route   GET /api/fee-reminders/stats
// @desc    Get fee reminder statistics
// @access  Private (Admin, Teacher)
router.get('/stats', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'week':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          }
        };
        break;
      case 'month':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        };
        break;
      case 'year':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), 0, 1)
          }
        };
        break;
    }

    const stats = await FeeReminder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const typeStats = await FeeReminder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$reminderType',
          count: { $sum: 1 }
        }
      }
    ]);

    const overallStats = await FeeReminder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalReminders: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          uniqueStudents: { $addToSet: '$studentId' }
        }
      },
      {
        $project: {
          totalReminders: 1,
          totalAmount: 1,
          uniqueStudents: { $size: '$uniqueStudents' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        statusStats: stats,
        typeStats,
        overall: overallStats[0] || { totalReminders: 0, totalAmount: 0, uniqueStudents: 0 },
        period
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee reminder statistics',
      error: error.message
    });
  }
});

// @route   POST /api/fee-reminders/schedule
// @desc    Schedule automatic fee reminders
// @access  Private (Admin)
router.post('/schedule', authorize('admin'), async (req, res) => {
  try {
    const {
      reminderType = 'before_due',
      daysBefore = 7,
      recurring = true,
      frequency = 'daily' // daily, weekly, monthly
    } = req.body;

    // In a real implementation, you would set up a cron job or scheduled task
    // For now, we'll just create the reminders immediately
    const reminders = await FeeReminder.createReminders(reminderType, daysBefore);

    res.json({
      success: true,
      message: `Scheduled ${reminders.length} fee reminders`,
      data: {
        reminders,
        schedule: {
          reminderType,
          daysBefore,
          recurring,
          frequency,
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next day
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to schedule fee reminders',
      error: error.message
    });
  }
});

// @route   DELETE /api/fee-reminders/:id
// @desc    Delete a fee reminder
// @access  Private (Admin)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const reminder = await FeeReminder.findByIdAndDelete(req.params.id);
    
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Fee reminder not found'
      });
    }

    res.json({
      success: true,
      message: 'Fee reminder deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete fee reminder',
      error: error.message
    });
  }
});

export default router;