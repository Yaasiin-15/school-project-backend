import express from 'express';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import Grade from '../models/Grade.js';
import Fee from '../models/Fee.js';
import Announcement from '../models/Announcement.js';
import User from '../models/User.js';

const router = express.Router();

// @route   GET /api/dashboard/admin
// @desc    Get admin dashboard data
// @access  Private (Admin only)
router.get('/admin', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }
    // Basic counts
    const totalStudents = await Student.countDocuments({ status: 'active' });
    const totalTeachers = await Teacher.countDocuments({ status: 'active' });
    const totalClasses = await Class.countDocuments({ status: 'active' });
    
    // Fee statistics - simplified approach
    const currentYear = new Date().getFullYear();
    const fees = await Fee.find({
      academicYear: `${currentYear}-${String(currentYear + 1).slice(2)}`
    });
    
    const totalRevenue = fees.reduce((sum, fee) => sum + (fee.paidAmount || 0), 0);
    const feeStats = [{ totalRevenue }];

    // Recent activities
    const recentGrades = await Grade.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('studentName subjectName score maxScore createdAt');

    const recentFees = await Fee.find({ status: 'paid' })
      .sort({ paidDate: -1 })
      .limit(5)
      .select('studentName amount paidDate type');

    // Grade distribution - simplified approach
    const allGrades = await Grade.find({});
    const gradeDistribution = {};
    
    allGrades.forEach(grade => {
      const gradeLevel = grade.gradeLevel || 'Unknown';
      gradeDistribution[gradeLevel] = (gradeDistribution[gradeLevel] || 0) + 1;
    });
    
    const gradeDistributionArray = Object.entries(gradeDistribution).map(([name, value]) => ({
      name,
      value
    }));

    // Monthly enrollment
    const monthlyEnrollment = await Student.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalTeachers,
          totalClasses,
          totalRevenue: feeStats[0]?.totalRevenue || 0
        },
        recentActivities: [
          ...recentGrades.map(grade => ({
            type: 'grade',
            message: `Grade updated for ${grade.studentName} in ${grade.subjectName}`,
            time: grade.createdAt
          })),
          ...recentFees.map(fee => ({
            type: 'payment',
            message: `Fee payment received from ${fee.studentName}`,
            time: fee.paidDate
          }))
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10),
        gradeDistribution: gradeDistributionArray,
        monthlyEnrollment
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/teacher
// @desc    Get teacher dashboard data
// @access  Private (Teacher)
router.get('/teacher', async (req, res) => {
  try {
    // Get teacher info from authenticated user
    const teacher = await Teacher.findOne({ userId: req.user._id });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found'
      });
    }

    // Get teacher's classes
    const classes = await Class.find({ teacherId: teacher._id }).populate('students', 'name studentId');
    const totalStudents = classes.reduce((sum, cls) => sum + cls.students.length, 0);

    // Get recent grades entered by teacher
    const recentGrades = await Grade.find({ teacherId: teacher._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Class performance
    const classPerformance = await Promise.all(
      classes.map(async (cls) => {
        const grades = await Grade.find({ classId: cls._id });
        const avgScore = grades.length > 0 
          ? grades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 100, 0) / grades.length
          : 0;
        
        return {
          className: cls.name,
          studentCount: cls.students.length,
          averageScore: Math.round(avgScore * 100) / 100
        };
      })
    );

    // Today's schedule based on teacher's subjects and classes
    const todaySchedule = teacher.subjects.map((subject, index) => ({
      subject,
      class: teacher.classes[index] || teacher.classes[0],
      time: `${9 + index * 2}:00 AM`,
      room: `Room ${101 + index}`
    }));

    res.json({
      success: true,
      data: {
        teacher: {
          name: teacher.name,
          subjects: teacher.subjects,
          classes: teacher.classes,
          department: teacher.department
        },
        stats: {
          totalStudents,
          totalClasses: classes.length,
          pendingGrades: recentGrades.filter(g => !g.gradeLevel).length,
          todayClasses: todaySchedule.length
        },
        recentGrades,
        classPerformance,
        todaySchedule
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/student
// @desc    Get student dashboard data
// @access  Private (Student)
router.get('/student', async (req, res) => {
  try {
    // Get student info from authenticated user
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Get recent grades
    const recentGrades = await Grade.find({ studentId: student._id })
      .sort({ date: -1 })
      .limit(10);

    // Calculate overall average
    const allGrades = await Grade.find({ studentId: student._id });
    const overallAverage = allGrades.length > 0
      ? allGrades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 100, 0) / allGrades.length
      : 0;

    // Get fee status
    const fees = await Fee.find({ studentId: student._id });
    const pendingFees = fees.filter(fee => fee.status === 'pending' || fee.status === 'partial');
    const totalPendingAmount = pendingFees.reduce((sum, fee) => sum + (fee.amount - fee.paidAmount), 0);

    // Subject performance
    const subjectPerformance = {};
    allGrades.forEach(grade => {
      const percentage = (grade.score / grade.maxScore) * 100;
      if (!subjectPerformance[grade.subjectName]) {
        subjectPerformance[grade.subjectName] = {
          total: 0,
          count: 0
        };
      }
      subjectPerformance[grade.subjectName].total += percentage;
      subjectPerformance[grade.subjectName].count += 1;
    });

    const subjects = Object.keys(subjectPerformance).map(subject => ({
      subject,
      average: Math.round((subjectPerformance[subject].total / subjectPerformance[subject].count) * 100) / 100
    }));

    // Get student's class info
    const studentClass = await Class.findOne({ 
      students: student._id 
    }).populate('teacherId', 'name subjects');

    // Today's schedule based on class subjects
    const todaySchedule = studentClass ? studentClass.subjects.map((subject, index) => ({
      subject,
      time: `${9 + index * 2}:00 AM`,
      room: `Room ${101 + index}`,
      teacher: studentClass.teacherId?.name || 'TBA'
    })) : [];

    // Upcoming assignments (mock data based on subjects)
    const assignments = subjects.slice(0, 3).map((subj, index) => ({
      subject: subj.subject,
      title: `${subj.subject} Assignment ${index + 1}`,
      dueDate: new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: index === 0 ? 'pending' : 'in-progress'
    }));

    res.json({
      success: true,
      data: {
        student: {
          name: student.name,
          studentId: student.studentId,
          class: student.class,
          section: student.section
        },
        stats: {
          overallGrade: overallAverage >= 90 ? 'A' : overallAverage >= 80 ? 'B' : overallAverage >= 70 ? 'C' : overallAverage >= 60 ? 'D' : 'F',
          overallAverage: Math.round(overallAverage * 100) / 100,
          attendance: 92, // Mock data - can be implemented with attendance tracking
          pendingAssignments: assignments.filter(a => a.status === 'pending').length,
          upcomingExams: 3, // Mock data
          pendingFees: pendingFees.length,
          totalPendingAmount
        },
        recentGrades,
        subjects,
        todaySchedule,
        assignments,
        pendingFees: pendingFees.map(fee => ({
          type: fee.type,
          amount: fee.amount,
          paidAmount: fee.paidAmount,
          dueDate: fee.dueDate,
          term: fee.term
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/overview
// @desc    Get general dashboard overview
// @access  Private
router.get('/overview', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalStudents = await Student.countDocuments({ status: 'active' });
    const totalTeachers = await Teacher.countDocuments({ status: 'active' });
    const totalClasses = await Class.countDocuments({ status: 'active' });
    
    // Recent announcements
    const recentAnnouncements = await Announcement.find({
      targetAudience: { $in: [req.user.role, 'all'] },
      isActive: true
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('title priority createdAt');

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalStudents,
          totalTeachers,
          totalClasses
        },
        recentAnnouncements
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview',
      error: error.message
    });
  }
});

export default router;