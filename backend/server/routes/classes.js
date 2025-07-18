import express from 'express';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/classes
// @desc    Get all classes with filtering
// @access  Private
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      grade,
      teacherId,
      academicYear,
      status = 'active'
    } = req.query;

    const query = {};
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (grade && grade !== 'all') {
      query.grade = grade;
    }
    
    if (teacherId && teacherId !== 'all') {
      query.teacherId = teacherId;
    }
    
    if (academicYear && academicYear !== 'all') {
      query.academicYear = academicYear;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { teacherName: { $regex: search, $options: 'i' } }
      ];
    }

    const classes = await Class.find(query)
      .populate('teacherId', 'name teacherId email')
      .populate('students', 'name studentId email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ grade: 1, section: 1 });

    const total = await Class.countDocuments(query);

    res.json({
      success: true,
      data: {
        classes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalClasses: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes',
      error: error.message
    });
  }
});

// @route   GET /api/classes/:id
// @desc    Get class by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('teacherId', 'name teacherId email phone')
      .populate('students', 'name studentId email avatar class section');
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      data: { class: classData }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch class',
      error: error.message
    });
  }
});

// @route   POST /api/classes
// @desc    Create new class
// @access  Private (Admin only)
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      section,
      grade,
      teacherId,
      subjects,
      room,
      capacity,
      academicYear
    } = req.body;

    // Get teacher information if provided
    let teacherName = '';
    if (teacherId) {
      const teacher = await Teacher.findById(teacherId);
      if (teacher) {
        teacherName = teacher.name;
      }
    }

    const classData = new Class({
      name,
      section,
      grade,
      teacherId,
      teacherName,
      subjects,
      room,
      capacity,
      academicYear
    });

    await classData.save();

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: { class: classData }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create class',
      error: error.message
    });
  }
});

// @route   PUT /api/classes/:id
// @desc    Update class
// @access  Private (Admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('teacherId', 'name email');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: { class: classData }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update class',
      error: error.message
    });
  }
});

// @route   DELETE /api/classes/:id
// @desc    Delete class
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete class',
      error: error.message
    });
  }
});

// @route   POST /api/classes/:id/students
// @desc    Add student to class
// @access  Private (Admin only)
router.post('/:id/students', authorize('admin'), async (req, res) => {
  try {
    const { studentId } = req.body;
    
    const classData = await Class.findById(req.params.id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student is already in class
    if (classData.students.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Student is already in this class'
      });
    }

    // Check class capacity
    if (classData.students.length >= classData.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Class is at full capacity'
      });
    }

    classData.students.push(studentId);
    await classData.save();

    // Update student's class
    student.class = classData.name;
    student.section = classData.section;
    await student.save();

    res.json({
      success: true,
      message: 'Student added to class successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add student to class',
      error: error.message
    });
  }
});

// @route   DELETE /api/classes/:id/students/:studentId
// @desc    Remove student from class
// @access  Private (Admin only)
router.delete('/:id/students/:studentId', authorize('admin'), async (req, res) => {
  try {
    const { id: classId, studentId } = req.params;
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    classData.students = classData.students.filter(
      sid => sid.toString() !== studentId
    );
    await classData.save();

    res.json({
      success: true,
      message: 'Student removed from class successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove student from class',
      error: error.message
    });
  }
});

// @route   GET /api/classes/teacher/me
// @desc    Get all classes assigned to the current teacher
// @access  Private (Teacher)
router.get('/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.user._id })
      .populate('students', 'name studentId email');
    res.json({ success: true, data: { classes } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch teacher classes', error: error.message });
  }
});

// @route   GET /api/classes/schedule/teacher/me
// @desc    Get schedule for the current teacher (today or weekly)
// @access  Private (Teacher)
router.get('/schedule/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    const weekly = req.query.weekly === 'true';
    const classes = await Class.find({ teacherId: req.user._id });
    if (weekly) {
      // Return all classes grouped by day for the week
      // Assume each class has a 'schedule' array: [{ day, time, subject, room }]
      let weeklySchedule = [];
      classes.forEach(cls => {
        if (Array.isArray(cls.schedule)) {
          cls.schedule.forEach(item => {
            weeklySchedule.push({
              day: item.day,
              time: item.time,
              className: cls.name,
              subject: item.subject,
              room: item.room
            });
          });
        }
      });
      res.json({ success: true, data: { weeklySchedule } });
    } else {
      // Return today's schedule
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      let schedule = [];
      classes.forEach(cls => {
        if (Array.isArray(cls.schedule)) {
          cls.schedule.forEach(item => {
            if (item.day === today) {
              schedule.push({
                id: cls._id,
                subject: item.subject,
                class: cls.name,
                room: item.room,
                time: item.time,
                status: 'upcoming' // You can enhance this logic
              });
            }
          });
        }
      });
      res.json({ success: true, data: { schedule } });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch teacher schedule', error: error.message });
  }
});

export default router;