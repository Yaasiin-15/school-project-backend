import express from 'express';
import Promotion from '../models/Promotion.js';
import Student from '../models/Student.js';
import Grade from '../models/Grade.js';
import Attendance from '../models/Attendance.js';
import Fee from '../models/Fee.js';
import Class from '../models/Class.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/promotions
// @desc    Get all promotion records with filtering
// @access  Private (Admin, Teacher)
router.get('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      grade,
      status,
      academicYear = '2024-25',
      term = 'Third Term'
    } = req.query;

    const query = { academicYear, term };
    
    if (status && status !== 'all') {
      query.promotionStatus = status;
    }
    
    if (grade && grade !== 'all') {
      query.currentGrade = grade;
    }
    
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { currentClass: { $regex: search, $options: 'i' } }
      ];
    }

    const promotions = await Promotion.find(query)
      .populate('studentId', 'name studentId email class section')
      .populate('approvedBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Promotion.countDocuments(query);

    res.json({
      success: true,
      data: {
        promotions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPromotions: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotion records',
      error: error.message
    });
  }
});

// @route   POST /api/promotions/evaluate
// @desc    Evaluate students for promotion based on exam results
// @access  Private (Admin)
router.post('/evaluate', authorize('admin'), async (req, res) => {
  try {
    const { classId, academicYear = '2024-25', term = 'Third Term' } = req.body;

    // Get all students in the class
    const classData = await Class.findById(classId).populate('students');
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const evaluationResults = [];

    for (const student of classData.students) {
      // Check if promotion record already exists
      let promotion = await Promotion.findOne({
        studentId: student._id,
        academicYear,
        term
      });

      if (!promotion) {
        // Create new promotion record
        promotion = new Promotion({
          studentId: student._id,
          studentName: student.name,
          currentClass: student.class,
          currentGrade: classData.grade,
          nextClass: getNextClass(student.class),
          nextGrade: getNextGrade(classData.grade),
          academicYear,
          term,
          requirements: {
            minimumAttendance: 75,
            minimumGrade: 65,
            requiredExams: ['midterm', 'final']
          }
        });
      }

      // Get exam results
      const midtermGrades = await Grade.find({
        studentId: student._id,
        examType: 'midterm',
        academicYear,
        term
      });

      const finalGrades = await Grade.find({
        studentId: student._id,
        examType: 'final',
        academicYear,
        term
      });

      // Calculate midterm results
      if (midtermGrades.length > 0) {
        const midtermAvg = midtermGrades.reduce((sum, grade) => sum + (grade.score / grade.maxScore * 100), 0) / midtermGrades.length;
        const passedSubjects = midtermGrades.filter(grade => (grade.score / grade.maxScore * 100) >= 65).length;
        
        promotion.examResults.midterm = {
          completed: true,
          averageScore: Math.round(midtermAvg * 100) / 100,
          totalSubjects: midtermGrades.length,
          passedSubjects,
          completedDate: new Date()
        };
      }

      // Calculate final results
      if (finalGrades.length > 0) {
        const finalAvg = finalGrades.reduce((sum, grade) => sum + (grade.score / grade.maxScore * 100), 0) / finalGrades.length;
        const passedSubjects = finalGrades.filter(grade => (grade.score / grade.maxScore * 100) >= 65).length;
        
        promotion.examResults.final = {
          completed: true,
          averageScore: Math.round(finalAvg * 100) / 100,
          totalSubjects: finalGrades.length,
          passedSubjects,
          completedDate: new Date()
        };
      }

      // Calculate overall average
      const allGrades = [...midtermGrades, ...finalGrades];
      if (allGrades.length > 0) {
        promotion.overallAverage = Math.round(
          (allGrades.reduce((sum, grade) => sum + (grade.score / grade.maxScore * 100), 0) / allGrades.length) * 100
        ) / 100;
      }

      // Calculate attendance percentage
      const totalDays = await Attendance.countDocuments({
        studentId: student._id,
        date: { $gte: new Date(new Date().getFullYear(), 0, 1) }
      });

      const presentDays = await Attendance.countDocuments({
        studentId: student._id,
        status: 'present',
        date: { $gte: new Date(new Date().getFullYear(), 0, 1) }
      });

      promotion.attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Check fee status
      const unpaidFees = await Fee.countDocuments({
        studentId: student._id,
        status: { $in: ['pending', 'overdue'] },
        academicYear
      });

      promotion.feeStatus = unpaidFees > 0 ? 'pending' : 'paid';

      // Check eligibility
      const eligibility = promotion.checkPromotionEligibility();
      
      await promotion.save();
      evaluationResults.push({
        studentId: student._id,
        studentName: student.name,
        promotionStatus: promotion.promotionStatus,
        eligibility: eligibility.eligible,
        requirements: eligibility.requirements
      });
    }

    res.json({
      success: true,
      message: 'Student promotion evaluation completed',
      data: {
        classId,
        className: classData.name,
        totalStudents: evaluationResults.length,
        eligible: evaluationResults.filter(r => r.eligibility).length,
        results: evaluationResults
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate students for promotion',
      error: error.message
    });
  }
});

// @route   POST /api/promotions/promote/:id
// @desc    Promote individual student
// @access  Private (Admin)
router.post('/promote/:id', authorize('admin'), async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion record not found'
      });
    }

    promotion.approvedBy = req.user._id;
    promotion.approvedByName = req.user.name;
    promotion.approvalDate = new Date();

    await promotion.promoteStudent();

    res.json({
      success: true,
      message: 'Student promoted successfully',
      data: { promotion }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to promote student',
      error: error.message
    });
  }
});

// @route   POST /api/promotions/bulk-promote
// @desc    Promote multiple students
// @access  Private (Admin)
router.post('/bulk-promote', authorize('admin'), async (req, res) => {
  try {
    const { classId, academicYear = '2024-25', studentIds } = req.body;

    let query = { academicYear, promotionStatus: 'eligible' };
    
    if (classId) {
      const classData = await Class.findById(classId);
      if (classData) {
        query.currentClass = classData.name;
      }
    }
    
    if (studentIds && studentIds.length > 0) {
      query.studentId = { $in: studentIds };
    }

    const results = await Promotion.processBulkPromotions(query, academicYear, req.user);

    res.json({
      success: true,
      message: 'Bulk promotion completed',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk promotions',
      error: error.message
    });
  }
});

// @route   GET /api/promotions/student/:studentId
// @desc    Get promotion history for a student
// @access  Private
router.get('/student/:studentId', authorize('admin', 'teacher', 'student'), async (req, res) => {
  try {
    const promotions = await Promotion.find({ studentId: req.params.studentId })
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { promotions }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student promotion history',
      error: error.message
    });
  }
});

// @route   GET /api/promotions/stats
// @desc    Get promotion statistics
// @access  Private (Admin, Teacher)
router.get('/stats', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { academicYear = '2024-25', term = 'Third Term' } = req.query;

    const stats = await Promotion.aggregate([
      { $match: { academicYear, term } },
      {
        $group: {
          _id: '$promotionStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const gradeStats = await Promotion.aggregate([
      { $match: { academicYear, term } },
      {
        $group: {
          _id: '$currentGrade',
          total: { $sum: 1 },
          eligible: {
            $sum: { $cond: [{ $eq: ['$promotionStatus', 'eligible'] }, 1, 0] }
          },
          promoted: {
            $sum: { $cond: [{ $eq: ['$promotionStatus', 'promoted'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overallStats: stats,
        gradeStats,
        academicYear,
        term
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotion statistics',
      error: error.message
    });
  }
});

// Helper functions
function getNextClass(currentClass) {
  // Extract grade number and increment
  const gradeMatch = currentClass.match(/Grade (\d+)/);
  if (gradeMatch) {
    const currentGrade = parseInt(gradeMatch[1]);
    const nextGrade = currentGrade + 1;
    return currentClass.replace(/Grade \d+/, `Grade ${nextGrade}`);
  }
  return currentClass;
}

function getNextGrade(currentGrade) {
  const grade = parseInt(currentGrade);
  return (grade + 1).toString();
}

export default router;