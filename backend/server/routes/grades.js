import express from 'express';
import Grade from '../models/Grade.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/grades
// @desc    Get all grades with filtering
// @access  Private
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      studentId,
      subjectName,
      examType,
      term,
      teacherId
    } = req.query;

    const query = {};

    if (studentId && studentId !== 'all') {
      query.studentId = studentId;
    }

    if (subjectName && subjectName !== 'all') {
      query.subjectName = subjectName;
    }

    if (examType && examType !== 'all') {
      query.examType = examType;
    }

    if (term && term !== 'all') {
      query.term = term;
    }

    if (teacherId && teacherId !== 'all') {
      query.teacherId = teacherId;
    }

    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { subjectName: { $regex: search, $options: 'i' } },
        { teacherName: { $regex: search, $options: 'i' } }
      ];
    }

    const grades = await Grade.find(query)
      .populate('studentId', 'name studentId email avatar')
      .populate('teacherId', 'name teacherId email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });

    const total = await Grade.countDocuments(query);

    res.json({
      success: true,
      data: {
        grades,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalGrades: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grades',
      error: error.message
    });
  }
});

// @route   GET /api/grades/:id
// @desc    Get grade by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id)
      .populate('studentId', 'name studentId email avatar class section')
      .populate('teacherId', 'name teacherId email');

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    res.json({
      success: true,
      data: { grade }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grade',
      error: error.message
    });
  }
});

// @route   POST /api/grades
// @desc    Create new grade
// @access  Private (Admin, Teacher)
router.post('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    console.log('POST /api/grades - Request body:', req.body);
    console.log('POST /api/grades - User:', req.user?.role, req.user?.id);

    const {
      studentId,
      classId,
      subjectName,
      examType,
      score,
      maxScore,
      teacherId,
      date,
      term,
      academicYear,
      weightage,
      remarks
    } = req.body;

    // Validate required fields
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    if (!subjectName) {
      return res.status(400).json({
        success: false,
        message: 'Subject name is required'
      });
    }

    if (!examType) {
      return res.status(400).json({
        success: false,
        message: 'Exam type is required'
      });
    }

    if (score === undefined || score === null) {
      return res.status(400).json({
        success: false,
        message: 'Score is required'
      });
    }

    if (!maxScore) {
      return res.status(400).json({
        success: false,
        message: 'Max score is required'
      });
    }

    console.log('Looking for student with ID:', studentId);

    // Get student information
    const student = await Student.findById(studentId);
    console.log('Found student:', student ? student.name : 'Not found');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student not found with ID: ${studentId}`
      });
    }

    // Get teacher information
    let teacherName = '';
    if (teacherId) {
      const teacher = await Teacher.findById(teacherId);
      if (teacher) {
        teacherName = teacher.name;
      }
    }

    const gradeData = {
      studentId,
      studentName: student.name,
      className: student.class,
      subjectName,
      examType,
      score: Number(score),
      maxScore: Number(maxScore),
      teacherId: teacherId || null,
      teacherName,
      date: date || new Date(),
      term: term || 'First Term',
      academicYear: academicYear || '2024-25',
      weightage: Number(weightage) || 10,
      remarks: remarks || ''
    };

    // Don't include classId for now to avoid validation issues

    console.log('Creating grade with data:', gradeData);

    const grade = new Grade(gradeData);
    await grade.save();

    console.log('Grade created successfully:', grade._id);

    res.status(201).json({
      success: true,
      message: 'Grade created successfully',
      data: { grade }
    });
  } catch (error) {
    console.error('Error creating grade:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create grade',
      error: error.message,
      details: error.stack
    });
  }
});

// @route   PUT /api/grades/:id
// @desc    Update grade
// @access  Private (Admin, Teacher)
router.put('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const grade = await Grade.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    res.json({
      success: true,
      message: 'Grade updated successfully',
      data: { grade }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update grade',
      error: error.message
    });
  }
});

// @route   DELETE /api/grades/:id
// @desc    Delete grade
// @access  Private (Admin, Teacher)
router.delete('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const grade = await Grade.findByIdAndDelete(req.params.id);

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    res.json({
      success: true,
      message: 'Grade deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete grade',
      error: error.message
    });
  }
});

// @route   GET /api/grades/analytics/student/:studentId
// @desc    Get student grade analytics
// @access  Private
router.get('/analytics/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term, academicYear } = req.query;

    const query = { studentId };
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;

    const grades = await Grade.find(query);

    // Calculate subject-wise averages
    const subjectAverages = {};
    grades.forEach(grade => {
      const percentage = (grade.score / grade.maxScore) * 100;
      if (!subjectAverages[grade.subjectName]) {
        subjectAverages[grade.subjectName] = {
          total: 0,
          count: 0,
          grades: []
        };
      }
      subjectAverages[grade.subjectName].total += percentage;
      subjectAverages[grade.subjectName].count += 1;
      subjectAverages[grade.subjectName].grades.push({
        examType: grade.examType,
        percentage,
        date: grade.date
      });
    });

    // Calculate overall average
    const subjects = Object.keys(subjectAverages).map(subject => ({
      subject,
      average: subjectAverages[subject].total / subjectAverages[subject].count,
      grades: subjectAverages[subject].grades
    }));

    const overallAverage = subjects.reduce((sum, subject) => sum + subject.average, 0) / subjects.length;

    res.json({
      success: true,
      data: {
        overallAverage: overallAverage || 0,
        subjects,
        totalGrades: grades.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get grade analytics',
      error: error.message
    });
  }
});

// @route   GET /api/grades/analytics/class/:classId
// @desc    Get class grade analytics
// @access  Private (Admin, Teacher)
router.get('/analytics/class/:classId', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { subject, term } = req.query;

    const query = { classId };
    if (subject) query.subjectName = subject;
    if (term) query.term = term;

    const grades = await Grade.find(query).populate('studentId', 'name studentId');

    // Calculate class statistics
    const totalStudents = new Set(grades.map(grade => grade.studentId.toString())).size;
    const averageScore = grades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 100, 0) / grades.length;

    // Grade distribution
    const gradeDistribution = {};
    grades.forEach(grade => {
      const level = grade.gradeLevel;
      gradeDistribution[level] = (gradeDistribution[level] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalStudents,
        totalGrades: grades.length,
        averageScore: averageScore || 0,
        gradeDistribution
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get class analytics',
      error: error.message
    });
  }
});

// @route   GET /api/grades/teacher/me
// @desc    Get all grades entered by the current teacher
// @access  Private (Teacher)
router.get('/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    const grades = await Grade.find({ teacherId: req.user._id })
      .populate('studentId', 'name studentId email')
      .populate('teacherId', 'name teacherId email');
    res.json({ success: true, data: { grades } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch grades for teacher', error: error.message });
  }
});

// @route   GET /api/grades/me
// @desc    Get all grades for the current student
// @access  Private (Student)
router.get('/me', authorize('student'), async (req, res) => {
  try {
    const grades = await Grade.find({ studentId: req.user._id })
      .populate('teacherId', 'name teacherId email');
    res.json({ success: true, data: { grades } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch grades for student', error: error.message });
  }
});

export default router;