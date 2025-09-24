import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import Parent from '../models/Parent.js';
import { authorize } from '../middleware/auth.js';
import { sendNotification } from '../services/notificationService.js';

const router = express.Router();

// Validation middleware
const validateAttendance = [
  body('student').isMongoId().withMessage('Valid student ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('status').isIn(['present', 'absent', 'late', 'excused', 'sick', 'holiday']).withMessage('Valid status is required')
];

// Mark attendance for single student
router.post('/mark', validateAttendance, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { student, class: classId, subject, date, status, reason, period, location, timeIn, timeOut } = req.body;

    // Check if attendance already exists for this student on this date
    const existingAttendance = await Attendance.findOne({
      student,
      date: new Date(date),
      attendanceType: req.body.attendanceType || 'daily',
      period: period || null
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this student on this date'
      });
    }

    const attendanceData = {
      student,
      class: classId,
      subject,
      teacher: req.user.teacherId || req.user._id,
      date: new Date(date),
      period,
      status,
      timeIn: timeIn ? new Date(timeIn) : (status === 'present' ? new Date() : null),
      timeOut: timeOut ? new Date(timeOut) : null,
      reason,
      location: location || 'classroom',
      attendanceType: req.body.attendanceType || 'daily',
      createdBy: req.user._id,
      academicYear: req.body.academicYear || '2024-25'
    };

    const attendance = new Attendance(attendanceData);
    await attendance.save();

    // Send notification to parents if absent
    if (['absent', 'late'].includes(status)) {
      try {
        await sendParentNotification(student, status, date, reason);
      } catch (notificationError) {
        console.error('Failed to send parent notification:', notificationError);
      }
    }

    await attendance.populate('student', 'name studentId class section');
    await attendance.populate('teacher', 'name');

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      error: error.message
    });
  }
});

// Bulk attendance marking
router.post('/bulk-mark', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { attendanceRecords, date, class: classId, subject, period } = req.body;

    if (!attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({
        success: false,
        message: 'Attendance records array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const record of attendanceRecords) {
      try {
        // Check if attendance already exists
        const existingAttendance = await Attendance.findOne({
          student: record.student,
          date: new Date(date),
          attendanceType: 'daily',
          period: period || null
        });

        if (existingAttendance) {
          // Update existing attendance
          Object.assign(existingAttendance, {
            status: record.status,
            reason: record.reason,
            timeIn: record.timeIn ? new Date(record.timeIn) : existingAttendance.timeIn,
            timeOut: record.timeOut ? new Date(record.timeOut) : existingAttendance.timeOut,
            modifiedBy: req.user._id,
            modificationReason: 'Bulk update'
          });
          await existingAttendance.save();
          results.push(existingAttendance);
        } else {
          // Create new attendance
          const attendanceData = {
            student: record.student,
            class: classId,
            subject,
            teacher: req.user.teacherId || req.user._id,
            date: new Date(date),
            period,
            status: record.status,
            reason: record.reason,
            timeIn: record.timeIn ? new Date(record.timeIn) : (record.status === 'present' ? new Date() : null),
            timeOut: record.timeOut ? new Date(record.timeOut) : null,
            attendanceType: 'daily',
            createdBy: req.user._id,
            academicYear: '2024-25'
          };

          const attendance = new Attendance(attendanceData);
          await attendance.save();
          results.push(attendance);
        }

        // Send notification for absent students
        if (['absent', 'late'].includes(record.status)) {
          try {
            await sendParentNotification(record.student, record.status, date, record.reason);
          } catch (notificationError) {
            console.error('Failed to send parent notification:', notificationError);
          }
        }
      } catch (error) {
        errors.push({
          student: record.student,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk attendance marked. ${results.length} records processed successfully`,
      data: {
        successful: results.length,
        failed: errors.length,
        errors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark bulk attendance',
      error: error.message
    });
  }
});

// @route   GET /api/attendance/student/:studentId
// @desc    Get attendance records for a student
// @access  Private
router.get('/student/:studentId', authorize('admin', 'teacher', 'student'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await Attendance.find({ studentId }).sort({ date: -1 });
    res.json({ success: true, data: { records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
  }
});

// @route   GET /api/attendance/class/:classId
// @desc    Get attendance records for a class
// @access  Private
router.get('/class/:classId', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const records = await Attendance.find({ classId }).sort({ date: -1 });
    res.json({ success: true, data: { records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
  }
});

// @route   GET /api/attendance/teacher/me
// @desc    Get all attendance records for classes taught by the current teacher
// @access  Private (Teacher)
router.get('/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    // Find all classes taught by this teacher
    const Class = (await import('../models/Class.js')).default;
    const classes = await Class.find({ teacherId: req.user._id });
    const classIds = classes.map(cls => cls._id);
    // Find all attendance records for those classes
    const records = await Attendance.find({ classId: { $in: classIds } }).sort({ date: -1 });
    res.json({ success: true, data: { attendance: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance for teacher', error: error.message });
  }
});

// @route   GET /api/attendance/me
// @desc    Get all attendance records for the current student
// @access  Private (Student)
router.get('/me', authorize('student'), async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.user._id }).sort({ date: -1 });
    res.json({ success: true, data: { attendance: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance for student', error: error.message });
  }
});

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (Admin, Teacher)
router.put('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.json({ success: true, message: 'Attendance updated', data: { attendance } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update attendance', error: error.message });
  }
});

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (Admin, Teacher)
router.delete('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.json({ success: true, message: 'Attendance deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete attendance', error: error.message });
  }
});

// Get attendance with advanced filtering and analytics
router.get('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (req.query.student) filter.student = req.query.student;
    if (req.query.class) filter.class = req.query.class;
    if (req.query.teacher) filter.teacher = req.query.teacher;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.attendanceType) filter.attendanceType = req.query.attendanceType;
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    
    // Date range filtering
    if (req.query.startDate && req.query.endDate) {
      filter.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    } else if (req.query.date) {
      const date = new Date(req.query.date);
      filter.date = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    const attendance = await Attendance.find(filter)
      .populate('student', 'name studentId class section rollNumber')
      .populate('teacher', 'name teacherId')
      .populate('subject', 'name code')
      .populate('class', 'name grade section')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Attendance.countDocuments(filter);

    res.json({
      success: true,
      data: attendance,
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
      message: 'Error fetching attendance records',
      error: error.message
    });
  }
});

// Get attendance summary for a class on a specific date
router.get('/class-summary/:classId', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();
    
    const summary = await Attendance.getClassAttendanceSummary(classId, date);
    
    // Get detailed records
    const records = await Attendance.find({
      class: classId,
      date: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999))
      },
      attendanceType: 'daily'
    })
    .populate('student', 'name studentId rollNumber')
    .sort({ 'student.rollNumber': 1 });

    res.json({
      success: true,
      data: {
        summary,
        records,
        date: date.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching class attendance summary',
      error: error.message
    });
  }
});

// Get student attendance percentage and analytics
router.get('/student/:studentId/analytics', authorize('admin', 'teacher', 'student', 'parent'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    // Calculate attendance percentage
    const attendanceStats = await Attendance.calculateAttendancePercentage(studentId, startDate, endDate);
    
    // Get monthly breakdown
    const monthlyStats = await Attendance.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          date: { $gte: startDate, $lte: endDate },
          attendanceType: 'daily'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0]
            }
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
            }
          },
          lateDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'late'] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          percentage: {
            $round: [
              { $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get recent attendance records
    const recentRecords = await Attendance.find({
      student: studentId,
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    })
    .populate('subject', 'name')
    .sort({ date: -1 })
    .limit(20);

    res.json({
      success: true,
      data: {
        overall: attendanceStats,
        monthly: monthlyStats,
        recent: recentRecords,
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student attendance analytics',
      error: error.message
    });
  }
});

// Get attendance reports with various filters
router.get('/reports', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { reportType, startDate, endDate, class: classId, grade } = req.query;
    
    let pipeline = [];
    
    // Match stage
    const matchStage = {
      attendanceType: 'daily'
    };
    
    if (startDate && endDate) {
      matchStage.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (classId) matchStage.class = new mongoose.Types.ObjectId(classId);
    
    pipeline.push({ $match: matchStage });
    
    // Lookup student details
    pipeline.push({
      $lookup: {
        from: 'students',
        localField: 'student',
        foreignField: '_id',
        as: 'studentDetails'
      }
    });
    
    pipeline.push({ $unwind: '$studentDetails' });
    
    // Filter by grade if specified
    if (grade) {
      pipeline.push({
        $match: { 'studentDetails.class': grade }
      });
    }
    
    switch (reportType) {
      case 'daily':
        pipeline.push({
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
            },
            totalStudents: { $sum: 1 },
            presentStudents: {
              $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] }
            },
            absentStudents: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
            }
          }
        });
        break;
        
      case 'student-wise':
        pipeline.push({
          $group: {
            _id: '$student',
            studentName: { $first: '$studentDetails.name' },
            studentId: { $first: '$studentDetails.studentId' },
            class: { $first: '$studentDetails.class' },
            totalDays: { $sum: 1 },
            presentDays: {
              $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] }
            },
            absentDays: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
            },
            lateDays: {
              $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
            }
          }
        });
        
        pipeline.push({
          $addFields: {
            attendancePercentage: {
              $round: [
                { $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100] },
                2
              ]
            }
          }
        });
        break;
        
      case 'class-wise':
        pipeline.push({
          $group: {
            _id: '$studentDetails.class',
            className: { $first: '$studentDetails.class' },
            totalStudents: { $addToSet: '$student' },
            totalRecords: { $sum: 1 },
            presentRecords: {
              $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] }
            }
          }
        });
        
        pipeline.push({
          $addFields: {
            totalStudents: { $size: '$totalStudents' },
            attendancePercentage: {
              $round: [
                { $multiply: [{ $divide: ['$presentRecords', '$totalRecords'] }, 100] },
                2
              ]
            }
          }
        });
        break;
    }
    
    pipeline.push({ $sort: { _id: 1 } });
    
    const reportData = await Attendance.aggregate(pipeline);
    
    res.json({
      success: true,
      data: {
        reportType,
        period: { startDate, endDate },
        results: reportData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating attendance report',
      error: error.message
    });
  }
});

// Get defaulters (students with low attendance)
router.get('/defaulters', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 75; // Default 75%
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const defaulters = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          attendanceType: 'daily'
        }
      },
      {
        $group: {
          _id: '$student',
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          attendancePercentage: {
            $round: [
              { $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100] },
              2
            ]
          }
        }
      },
      {
        $match: {
          attendancePercentage: { $lt: threshold }
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'parents',
          localField: '_id',
          foreignField: 'children.studentId',
          as: 'parents'
        }
      },
      { $sort: { attendancePercentage: 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        threshold,
        period: { startDate, endDate },
        defaulters
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance defaulters',
      error: error.message
    });
  }
});

// Send attendance notifications to parents
router.post('/notify-parents', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { studentIds, message, notificationType } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({
        success: false,
        message: 'Student IDs array is required'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const studentId of studentIds) {
      try {
        await sendParentNotification(studentId, notificationType, new Date(), message);
        results.push({ studentId, status: 'sent' });
      } catch (error) {
        errors.push({ studentId, error: error.message });
      }
    }
    
    res.json({
      success: true,
      message: `Notifications sent to ${results.length} parents`,
      data: { successful: results.length, failed: errors.length, errors }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending parent notifications',
      error: error.message
    });
  }
});

// Helper function to send parent notifications
async function sendParentNotification(studentId, status, date, reason) {
  try {
    // Find parents for this student
    const parents = await Parent.find({
      'children.studentId': studentId,
      status: 'active'
    }).populate('children.studentId', 'name studentId class section');
    
    if (parents.length === 0) return;
    
    const student = parents[0].children.find(child => 
      child.studentId._id.toString() === studentId.toString()
    );
    
    if (!student) return;
    
    const notificationData = {
      type: 'attendance',
      title: `Attendance Alert - ${student.studentId.name}`,
      message: `Your child ${student.studentId.name} was marked ${status} on ${date.toDateString()}${reason ? `. Reason: ${reason}` : ''}`,
      recipients: parents.map(parent => parent.email).filter(Boolean),
      studentId,
      date,
      status,
      reason
    };
    
    // Send notification (implement based on your notification service)
    await sendNotification(notificationData);
    
    // Update attendance record to mark notification as sent
    await Attendance.updateOne(
      { student: studentId, date },
      { 
        parentNotified: true, 
        notificationSentAt: new Date() 
      }
    );
  } catch (error) {
    console.error('Error sending parent notification:', error);
    throw error;
  }
}

export default router;