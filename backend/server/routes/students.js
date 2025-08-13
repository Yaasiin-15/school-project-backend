import express from 'express';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Grade from '../models/Grade.js';
import Fee from '../models/Fee.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/students
// @desc    Get all students with filtering and pagination
// @access  Private (Admin, Teacher)
router.get('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      class: className,
      section,
      status = 'active'
    } = req.query;

    const query = {};

    if (status !== 'all') {
      query.status = status;
    }

    if (className && className !== 'all') {
      query.class = className;
    }

    if (section && section !== 'all') {
      query.section = section;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await Student.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Student.countDocuments(query);

    res.json({
      success: true,
      data: {
        students,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalStudents: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// @route   GET /api/students/:id
// @desc    Get student by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('userId', 'lastLogin isActive');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get student's grades
    const grades = await Grade.find({ studentId: student._id })
      .sort({ date: -1 })
      .limit(10);

    // Get student's fees
    const fees = await Fee.find({ studentId: student._id })
      .sort({ dueDate: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        student,
        recentGrades: grades,
        recentFees: fees
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student',
      error: error.message
    });
  }
});

// @route   POST /api/students
// @desc    Create new student
// @access  Private (Admin only)
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      email,
      password = 'student123',
      class: className,
      section,
      rollNumber,
      dateOfBirth,
      phone,
      emergencyContact,
      address,
      parentInfo
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Generate student ID
    const studentCount = await Student.countDocuments();
    const studentId = `S${String(studentCount + 1).padStart(3, '0')}`;

    // Create user account
    const user = new User({
      name,
      email,
      password,
      role: 'student',
      studentId
    });

    await user.save();

    // Create student record
    const student = new Student({
      userId: user._id,
      studentId,
      name,
      email,
      class: className,
      section,
      rollNumber,
      dateOfBirth,
      phone,
      emergencyContact,
      address,
      parentInfo
    });

    await student.save();

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: { student }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create student',
      error: error.message
    });
  }
});

// @route   PUT /api/students/:id
// @desc    Update student
// @access  Private (Admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: { student }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message
    });
  }
});

// @route   DELETE /api/students/:id
// @desc    Delete student
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Delete associated user account
    await User.findByIdAndDelete(student.userId);

    // Delete student record
    await Student.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message
    });
  }
});

// @route   GET /api/students/:id/grades
// @desc    Get student's grades
// @access  Private
router.get('/:id/grades', async (req, res) => {
  try {
    const { term, subject } = req.query;

    const query = { studentId: req.params.id };
    if (term) query.term = term;
    if (subject) query.subjectName = subject;

    const grades = await Grade.find(query).sort({ date: -1 });

    res.json({
      success: true,
      data: { grades }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grades',
      error: error.message
    });
  }
});

// @route   GET /api/students/:id/fees
// @desc    Get student's fees
// @access  Private
router.get('/:id/fees', async (req, res) => {
  try {
    const { status, term } = req.query;

    const query = { studentId: req.params.id };
    if (status && status !== 'all') query.status = status;
    if (term && term !== 'all') query.term = term;

    const fees = await Fee.find(query).sort({ dueDate: -1 });

    res.json({
      success: true,
      data: { fees }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fees',
      error: error.message
    });
  }
});

// @route   GET /api/students/me
// @desc    Get current student's profile (based on logged-in user)
// @access  Private (Student)
router.get('/me', authorize('student'), async (req, res) => {
  try {
    // Find the student profile by the logged-in user's ID
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    res.json({ success: true, data: { student } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch student profile', error: error.message });
  }
});

// @route   PUT /api/students/me
// @desc    Update current student's profile
// @access  Private (Student)
router.put('/me', authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Update student record
    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      req.body,
      { new: true, runValidators: true }
    );

    // Update user record with basic info
    await User.findByIdAndUpdate(req.user._id, {
      name: req.body.name || student.name,
      email: req.body.email || student.email
    });

    res.json({ success: true, data: { student: updatedStudent } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update student profile', error: error.message });
  }
});

// @route   GET /api/students/teacher/me
// @desc    Get all students assigned to the current teacher
// @access  Private (Teacher)
router.get('/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    // Find all classes taught by this teacher
    const Class = (await import('../models/Class.js')).default;
    const classes = await Class.find({ teacherId: req.user._id });
    const classIds = classes.map(cls => cls._id);
    // Find all students in those classes
    const students = await Student.find({ class: { $in: classIds } });
    res.json({ success: true, data: { students } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch students for teacher', error: error.message });
  }
});



// @route   GET /api/students/schedule/student/me
// @desc    Get current student's weekly schedule
// @access  Private (Student)
router.get('/schedule/student/me', authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Find the student's class
    const Class = (await import('../models/Class.js')).default;
    const studentClass = await Class.findOne({
      students: student._id
    }).populate('teacherId', 'name');

    // Generate a basic weekly schedule based on class subjects
    const weeklySchedule = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const subjects = studentClass?.subjects || [];

    days.forEach((day, dayIndex) => {
      subjects.slice(0, 3).forEach((subject, subjectIndex) => {
        const hour = 9 + (subjectIndex * 2);
        weeklySchedule.push({
          day,
          time: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
          subject,
          teacher: studentClass?.teacherId?.name || 'TBA',
          room: studentClass?.room || `Room ${101 + subjectIndex}`
        });
      });
    });

    res.json({ success: true, data: { weeklySchedule } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch student schedule', error: error.message });
  }
});

export default router;