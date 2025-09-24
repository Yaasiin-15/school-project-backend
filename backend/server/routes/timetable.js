import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import Timetable from '../models/Timetable.js';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import Subject from '../models/Subject.js';
import { generateId } from '../utils/helpers.js';

const router = express.Router();

// Validation middleware
const validateTimetable = [
  body('name').trim().isLength({ min: 2 }).withMessage('Timetable name is required'),
  body('type').isIn(['class', 'teacher', 'room', 'master']).withMessage('Valid timetable type is required'),
  body('academicYear').trim().isLength({ min: 4 }).withMessage('Academic year is required'),
  body('effectiveFrom').isISO8601().withMessage('Valid effective date is required')
];

// Get all timetables with filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.class) filter.class = req.query.class;
    if (req.query.teacher) filter.teacher = req.query.teacher;

    const timetables = await Timetable.find(filter)
      .populate('teacher', 'name teacherId')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Timetable.countDocuments(filter);

    res.json({
      success: true,
      data: timetables,
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
      message: 'Error fetching timetables',
      error: error.message
    });
  }
});

// Get timetable by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate('teacher', 'name teacherId email')
      .populate('schedule.periods.subject', 'name code')
      .populate('schedule.periods.teacher', 'name teacherId')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    res.json({
      success: true,
      data: timetable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching timetable',
      error: error.message
    });
  }
});

// Create new timetable
router.post('/', validateTimetable, authMiddleware, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if timetable already exists for the same criteria
    const existingTimetable = await Timetable.findOne({
      type: req.body.type,
      class: req.body.class,
      teacher: req.body.teacher,
      room: req.body.room,
      academicYear: req.body.academicYear,
      status: { $in: ['draft', 'active'] }
    });

    if (existingTimetable) {
      return res.status(400).json({
        success: false,
        message: 'Timetable already exists for this criteria'
      });
    }

    const timetableData = {
      ...req.body,
      timetableId: generateId('TT'),
      createdBy: req.user._id
    };

    const timetable = new Timetable(timetableData);
    await timetable.save();

    await timetable.populate('teacher', 'name teacherId');
    await timetable.populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Timetable created successfully',
      data: timetable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating timetable',
      error: error.message
    });
  }
});

// Update timetable
router.put('/:id', validateTimetable, authMiddleware, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    // Check if timetable is active and user has permission to modify
    if (timetable.status === 'active' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify active timetable without admin permission'
      });
    }

    Object.assign(timetable, req.body);
    await timetable.save();

    await timetable.populate('teacher', 'name teacherId');
    await timetable.populate('createdBy', 'name');

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: timetable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating timetable',
      error: error.message
    });
  }
});

// Delete timetable
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    // Only allow deletion of draft timetables or by admin
    if (timetable.status !== 'draft' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete non-draft timetable without admin permission'
      });
    }

    timetable.status = 'archived';
    await timetable.save();

    res.json({
      success: true,
      message: 'Timetable archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting timetable',
      error: error.message
    });
  }
});

// Get timetable for specific class
router.get('/class/:classId', authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    const academicYear = req.query.academicYear || '2024-25';

    const timetable = await Timetable.findOne({
      type: 'class',
      class: classId,
      academicYear,
      status: 'active'
    })
    .populate('schedule.periods.subject', 'name code')
    .populate('schedule.periods.teacher', 'name teacherId');

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'No active timetable found for this class'
      });
    }

    res.json({
      success: true,
      data: timetable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching class timetable',
      error: error.message
    });
  }
});

// Get timetable for specific teacher
router.get('/teacher/:teacherId', authMiddleware, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const academicYear = req.query.academicYear || '2024-25';

    const timetable = await Timetable.findOne({
      type: 'teacher',
      teacher: teacherId,
      academicYear,
      status: 'active'
    })
    .populate('schedule.periods.subject', 'name code')
    .populate('schedule.periods.teacher', 'name teacherId');

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'No active timetable found for this teacher'
      });
    }

    res.json({
      success: true,
      data: timetable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching teacher timetable',
      error: error.message
    });
  }
});

// Auto-generate timetable
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { type, class: classId, academicYear, constraints } = req.body;

    if (!type || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Type and academic year are required'
      });
    }

    // Get subjects and teachers for the class
    const subjects = await Subject.find({ 
      gradeLevel: { $in: [classId] },
      status: 'active'
    }).populate('teachers.teacherId', 'name teacherId');

    const teachers = await Teacher.find({ status: 'active' });

    // Generate basic timetable structure
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const periods = Array.from({ length: constraints?.maxPeriodsPerDay || 8 }, (_, i) => i + 1);

    const schedule = days.map(day => ({
      day,
      periods: periods.map(periodNumber => {
        // Simple random assignment for demo
        const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
        const randomTeacher = randomSubject?.teachers?.[0]?.teacherId || teachers[0];

        return {
          periodNumber,
          startTime: `${7 + periodNumber}:00`,
          endTime: `${8 + periodNumber}:00`,
          subject: randomSubject?._id,
          teacher: randomTeacher?._id,
          room: `Room ${100 + periodNumber}`,
          type: 'theory'
        };
      })
    }));

    const timetableData = {
      timetableId: generateId('TT'),
      name: `Auto-generated ${type} timetable`,
      type,
      class: classId,
      academicYear,
      schedule,
      constraints: constraints || {
        maxPeriodsPerDay: 8,
        breakTimes: [
          { name: 'Short Break', startTime: '10:30', endTime: '10:45', duration: 15 },
          { name: 'Lunch Break', startTime: '12:30', endTime: '13:15', duration: 45 }
        ]
      },
      status: 'draft',
      effectiveFrom: new Date(),
      createdBy: req.user._id
    };

    const timetable = new Timetable(timetableData);
    await timetable.save();

    // Check for conflicts
    const conflicts = await checkTimetableConflicts(timetable);
    if (conflicts.length > 0) {
      timetable.conflicts = conflicts;
      await timetable.save();
    }

    await timetable.populate('schedule.periods.subject', 'name code');
    await timetable.populate('schedule.periods.teacher', 'name teacherId');

    res.status(201).json({
      success: true,
      message: 'Timetable generated successfully',
      data: timetable,
      conflicts: conflicts.length > 0 ? conflicts : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating timetable',
      error: error.message
    });
  }
});

// Check timetable conflicts
router.post('/:id/check-conflicts', authMiddleware, async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const conflicts = await checkTimetableConflicts(timetable);
    
    // Update timetable with conflicts
    timetable.conflicts = conflicts;
    await timetable.save();

    res.json({
      success: true,
      data: {
        conflictCount: conflicts.length,
        conflicts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking conflicts',
      error: error.message
    });
  }
});

// Approve timetable
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can approve timetables'
      });
    }

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    // Check for unresolved conflicts
    const unresolvedConflicts = timetable.conflicts?.filter(c => !c.resolved) || [];
    if (unresolvedConflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve timetable with unresolved conflicts',
        conflicts: unresolvedConflicts
      });
    }

    // Deactivate other active timetables of the same type
    await Timetable.updateMany(
      {
        type: timetable.type,
        class: timetable.class,
        teacher: timetable.teacher,
        room: timetable.room,
        academicYear: timetable.academicYear,
        status: 'active',
        _id: { $ne: timetable._id }
      },
      { status: 'archived' }
    );

    timetable.status = 'active';
    timetable.approvedBy = req.user._id;
    timetable.approvedAt = new Date();
    await timetable.save();

    await timetable.populate('approvedBy', 'name');

    res.json({
      success: true,
      message: 'Timetable approved and activated successfully',
      data: timetable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving timetable',
      error: error.message
    });
  }
});

// Helper function to check timetable conflicts
async function checkTimetableConflicts(timetable) {
  const conflicts = [];

  for (const daySchedule of timetable.schedule) {
    for (const period of daySchedule.periods) {
      if (!period.teacher || !period.subject) continue;

      // Check teacher conflicts
      const teacherConflicts = await Timetable.find({
        _id: { $ne: timetable._id },
        status: { $in: ['active', 'draft'] },
        academicYear: timetable.academicYear,
        'schedule.day': daySchedule.day,
        'schedule.periods': {
          $elemMatch: {
            teacher: period.teacher,
            startTime: period.startTime,
            endTime: period.endTime
          }
        }
      });

      if (teacherConflicts.length > 0) {
        conflicts.push({
          type: 'teacher_clash',
          description: `Teacher conflict on ${daySchedule.day} at ${period.startTime}`,
          severity: 'high',
          resolved: false
        });
      }

      // Check room conflicts
      if (period.room) {
        const roomConflicts = await Timetable.find({
          _id: { $ne: timetable._id },
          status: { $in: ['active', 'draft'] },
          academicYear: timetable.academicYear,
          'schedule.day': daySchedule.day,
          'schedule.periods': {
            $elemMatch: {
              room: period.room,
              startTime: period.startTime,
              endTime: period.endTime
            }
          }
        });

        if (roomConflicts.length > 0) {
          conflicts.push({
            type: 'room_clash',
            description: `Room conflict for ${period.room} on ${daySchedule.day} at ${period.startTime}`,
            severity: 'medium',
            resolved: false
          });
        }
      }
    }
  }

  return conflicts;
}

export default router;