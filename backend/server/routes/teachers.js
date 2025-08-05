import express from 'express';
import Teacher from '../models/Teacher.js';
import User from '../models/User.js';
import Class from '../models/Class.js';
import Grade from '../models/Grade.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/teachers
// @desc    Get all teachers with filtering and pagination
// @access  Private (Admin, Teacher)
router.get('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      department,
      subject,
      status = 'active'
    } = req.query;

    const query = {};
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (department && department !== 'all') {
      query.department = department;
    }
    
    if (subject && subject !== 'all') {
      query.subjects = { $in: [subject] };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { teacherId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const teachers = await Teacher.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Teacher.countDocuments(query);

    res.json({
      success: true,
      data: {
        teachers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTeachers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers',
      error: error.message
    });
  }
});

// @route   GET /api/teachers/:id
// @desc    Get teacher by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate('userId', 'lastLogin isActive');
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Get teacher's classes
    const classes = await Class.find({ teacherId: teacher._id })
      .select('name section grade studentCount capacity');

    // Get recent grades entered by teacher
    const recentGrades = await Grade.find({ teacherId: teacher._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('studentId', 'name studentId');

    res.json({
      success: true,
      data: {
        teacher,
        classes,
        recentGrades
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher',
      error: error.message
    });
  }
});

// @route   POST /api/teachers
// @desc    Create new teacher
// @access  Private (Admin only)
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      email,
      password = 'teacher123',
      phone,
      subjects,
      classes,
      qualification,
      experience,
      department,
      salary,
      address,
      personalInfo
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Generate teacher ID
    const teacherCount = await Teacher.countDocuments();
    const teacherId = `T${String(teacherCount + 1).padStart(3, '0')}`;

    // Create user account
    const user = new User({
      name,
      email,
      password,
      role: 'teacher',
      teacherId
    });

    await user.save();

    // Create teacher record
    const teacher = new Teacher({
      userId: user._id,
      teacherId,
      name,
      email,
      phone,
      subjects,
      classes,
      qualification,
      experience,
      department,
      salary,
      address,
      personalInfo
    });

    await teacher.save();

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: { teacher }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create teacher',
      error: error.message
    });
  }
});

// @route   PUT /api/teachers/:id
// @desc    Update teacher
// @access  Private (Admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    res.json({
      success: true,
      message: 'Teacher updated successfully',
      data: { teacher }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update teacher',
      error: error.message
    });
  }
});

// @route   DELETE /api/teachers/:id
// @desc    Delete teacher
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Delete associated user account
    await User.findByIdAndDelete(teacher.userId);
    
    // Delete teacher record
    await Teacher.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Teacher deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete teacher',
      error: error.message
    });
  }
});

// @route   GET /api/teachers/:id/classes
// @desc    Get teacher's classes
// @access  Private
router.get('/:id/classes', async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.params.id })
      .populate('students', 'name studentId email');

    res.json({
      success: true,
      data: { classes }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes',
      error: error.message
    });
  }
});

// @route   GET /api/teachers/:id/students
// @desc    Get teacher's students
// @access  Private
router.get('/:id/students', async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.params.id })
      .populate('students', 'name studentId email class section avatar');

    const students = classes.reduce((acc, cls) => {
      return acc.concat(cls.students);
    }, []);

    res.json({
      success: true,
      data: { students }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// @route   GET /api/teachers/me
// @desc    Get current teacher's profile (based on logged-in user)
// @access  Private (Teacher)
router.get('/me', authorize('teacher'), async (req, res) => {
  try {
    // Find the teacher profile by the logged-in user's ID
    const teacher = await Teacher.findOne({ userId: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }
    res.json({ success: true, data: { teacher } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch teacher profile', error: error.message });
  }
});

// @route   PUT /api/teachers/me
// @desc    Update current teacher's profile
// @access  Private (Teacher)
router.put('/me', authorize('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ userId: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Update teacher record
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      teacher._id,
      req.body,
      { new: true, runValidators: true }
    );

    // Update user record with basic info
    await User.findByIdAndUpdate(req.user._id, {
      name: req.body.name || teacher.name,
      email: req.body.email || teacher.email
    });

    res.json({ success: true, data: { teacher: updatedTeacher } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update teacher profile', error: error.message });
  }
});

export default router;