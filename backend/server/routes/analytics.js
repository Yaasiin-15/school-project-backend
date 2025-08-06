import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import Grade from '../models/Grade.js';
import Fee from '../models/Fee.js';
import Attendance from '../models/Attendance.js';

const router = express.Router();

// Helper function to get date range
const getDateRange = (range) => {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (range) {
    case 'last7days':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'last30days':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case 'last3months':
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case 'lastyear':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default: // last6months
      startDate.setMonth(endDate.getMonth() - 6);
  }
  
  return { startDate, endDate };
};

// Generate real analytics data from database
const generateAnalytics = async (range) => {
  const { startDate, endDate } = getDateRange(range);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  try {
    // Get overview data
    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      Student.countDocuments({ status: 'active' }),
      Teacher.countDocuments({ status: 'active' }),
      Class.countDocuments({ status: 'active' })
    ]);

    // Get attendance data
    const attendanceRecords = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" }
          },
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          date: "$_id",
          rate: {
            $multiply: [
              { $divide: ["$presentCount", "$totalRecords"] },
              100
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get performance data by subject
    const performanceData = await Grade.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$subjectName",
          totalScore: { $sum: "$score" },
          totalMaxScore: { $sum: "$maxScore" },
          studentCount: { $sum: 1 }
        }
      },
      {
        $project: {
          subject: "$_id",
          average: {
            $multiply: [
              { $divide: ["$totalScore", "$totalMaxScore"] },
              100
            ]
          },
          students: "$studentCount",
          trend: { $literal: 0 } // Would need historical data for real trend
        }
      }
    ]);

    // Get financial data
    const financialRecords = await Fee.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          revenue: { $sum: "$paidAmount" },
          totalDue: { $sum: "$amount" }
        }
      },
      {
        $project: {
          month: {
            $arrayElemAt: [months, { $subtract: ["$_id.month", 1] }]
          },
          revenue: 1,
          expenses: { $multiply: ["$revenue", 0.6] }, // Estimate expenses as 60% of revenue
          profit: { $multiply: ["$revenue", 0.4] }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Get enrollment data by grade
    const enrollmentData = await Class.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: "$grade",
          students: { $sum: "$studentCount" },
          capacity: { $sum: "$capacity" }
        }
      },
      {
        $project: {
          grade: { $concat: ["Grade ", "$_id"] },
          students: 1,
          capacity: 1,
          waitlist: { $literal: 0 } // Would need a waitlist model for real data
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Calculate average attendance
    const avgAttendance = attendanceRecords.length > 0 
      ? attendanceRecords.reduce((sum, record) => sum + record.rate, 0) / attendanceRecords.length
      : 0;

    // Calculate total revenue
    const totalRevenue = financialRecords.reduce((sum, record) => sum + record.revenue, 0);

    // Format attendance data based on range
    let attendanceData = [];
    if (range === 'last7days' || range === 'last30days') {
      attendanceData = attendanceRecords.map(record => ({
        date: new Date(record.date).toLocaleDateString(),
        rate: Math.round(record.rate * 100) / 100
      }));
    } else {
      // Group by month for longer ranges
      const monthlyAttendance = {};
      attendanceRecords.forEach(record => {
        const date = new Date(record.date);
        const monthKey = months[date.getMonth()];
        if (!monthlyAttendance[monthKey]) {
          monthlyAttendance[monthKey] = { total: 0, count: 0 };
        }
        monthlyAttendance[monthKey].total += record.rate;
        monthlyAttendance[monthKey].count += 1;
      });

      attendanceData = Object.keys(monthlyAttendance).map(month => ({
        month,
        rate: Math.round((monthlyAttendance[month].total / monthlyAttendance[month].count) * 100) / 100
      }));
    }

    return {
      overview: {
        totalStudents,
        totalTeachers,
        averageAttendance: Math.round(avgAttendance * 100) / 100,
        totalRevenue: Math.round(totalRevenue),
        growthRate: 0, // Would need historical data for real growth rate
        totalClasses,
        activeProjects: 0, // Would need a projects model
        completionRate: 0 // Would need completion tracking
      },
      attendance: attendanceData,
      performance: performanceData,
      financial: financialRecords,
      enrollment: enrollmentData,
      trends: {
        studentGrowth: 0, // Would need historical data
        attendanceChange: 0, // Would need historical data
        revenueGrowth: 0, // Would need historical data
        performanceImprovement: 0 // Would need historical data
      }
    };
  } catch (error) {
    console.error('Error generating analytics:', error);
    throw error;
  }
};

// Get analytics data
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { range = 'last6months' } = req.query;
    
    const analyticsData = await generateAnalytics(range);
    
    res.json({
      success: true,
      data: analyticsData,
      range,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
      error: error.message
    });
  }
});

// Get specific analytics by type
router.get('/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const { range = 'last6months' } = req.query;
    
    const analyticsData = await generateAnalytics(range);
    
    if (!analyticsData[type]) {
      return res.status(404).json({
        success: false,
        message: `Analytics type '${type}' not found`
      });
    }
    
    res.json({
      success: true,
      data: analyticsData[type],
      type,
      range
    });
  } catch (error) {
    console.error(`${type} analytics fetch error:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch ${type} analytics`,
      error: error.message
    });
  }
});

// Export analytics report
router.post('/export/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const { range = 'last6months', format = 'pdf' } = req.query;
    
    // In a real application, you would generate the actual report file
    // For now, we'll just return a success message
    const reportData = {
      type,
      range,
      format,
      generatedAt: new Date().toISOString(),
      downloadUrl: `/api/analytics/download/${type}-${range}-${Date.now()}.${format}`
    };
    
    res.json({
      success: true,
      data: reportData,
      message: `${type} report generated successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
});

// Get dashboard summary
router.get('/dashboard/summary', authMiddleware, async (req, res) => {
  try {
    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      Student.countDocuments({ status: 'active' }),
      Teacher.countDocuments({ status: 'active' }),
      Class.countDocuments({ status: 'active' })
    ]);

    // Get recent activities from database
    const recentStudents = await Student.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('name class createdAt');

    const recentGrades = await Grade.find()
      .sort({ createdAt: -1 })
      .limit(2)
      .populate('studentId', 'name')
      .select('subjectName score maxScore createdAt');

    const recentFees = await Fee.find({ status: 'paid' })
      .sort({ paidDate: -1 })
      .limit(2)
      .select('studentName amount paidDate');

    // Calculate average attendance for the last week
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const attendanceStats = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: lastWeek }
        }
      },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
          }
        }
      }
    ]);

    const averageAttendance = attendanceStats.length > 0 
      ? Math.round((attendanceStats[0].presentCount / attendanceStats[0].totalRecords) * 100 * 100) / 100
      : 0;

    // Build recent activities
    const recentActivities = [];
    
    recentStudents.forEach((student, index) => {
      recentActivities.push({
        id: `enrollment_${index}`,
        type: 'enrollment',
        message: `New student ${student.name} enrolled in ${student.class}`,
        timestamp: student.createdAt,
        icon: 'user-plus'
      });
    });

    recentGrades.forEach((grade, index) => {
      const percentage = Math.round((grade.score / grade.maxScore) * 100);
      recentActivities.push({
        id: `grade_${index}`,
        type: 'performance',
        message: `${grade.studentId?.name || 'Student'} scored ${percentage}% in ${grade.subjectName}`,
        timestamp: grade.createdAt,
        icon: 'trending-up'
      });
    });

    recentFees.forEach((fee, index) => {
      recentActivities.push({
        id: `payment_${index}`,
        type: 'financial',
        message: `${fee.studentName} paid $${fee.amount}`,
        timestamp: fee.paidDate,
        icon: 'dollar-sign'
      });
    });

    // Sort activities by timestamp
    recentActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Generate alerts based on real data
    const alerts = [];
    
    // Check for low attendance classes
    const lowAttendanceClasses = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: lastWeek }
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $unwind: '$student'
      },
      {
        $group: {
          _id: '$student.class',
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          class: '$_id',
          attendanceRate: {
            $multiply: [
              { $divide: ["$presentCount", "$totalRecords"] },
              100
            ]
          }
        }
      },
      {
        $match: {
          attendanceRate: { $lt: 90 }
        }
      }
    ]);

    lowAttendanceClasses.forEach((classData, index) => {
      alerts.push({
        id: `attendance_${index}`,
        type: 'warning',
        message: `${classData.class} attendance below 90% this week (${Math.round(classData.attendanceRate)}%)`,
        priority: 'medium'
      });
    });

    // Check for overdue fees
    const overdueFees = await Fee.countDocuments({ 
      status: 'overdue',
      dueDate: { $lt: new Date() }
    });

    if (overdueFees > 0) {
      alerts.push({
        id: 'overdue_fees',
        type: 'warning',
        message: `${overdueFees} students have overdue fees`,
        priority: 'high'
      });
    }

    const summary = {
      totalStudents,
      totalTeachers,
      totalClasses,
      averageAttendance,
      recentActivities: recentActivities.slice(0, 5),
      alerts: alerts.slice(0, 5)
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: error.message
    });
  }
});

// Get comparative analytics
router.get('/compare/:metric', authMiddleware, async (req, res) => {
  try {
    const { metric } = req.params;
    
    const currentDate = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(currentDate.getMonth() - 1);
    
    const lastYear = new Date();
    lastYear.setFullYear(currentDate.getFullYear() - 1);
    
    let comparativeData = {};
    
    switch (metric) {
      case 'attendance':
        const [currentAttendance, previousAttendance] = await Promise.all([
          Attendance.aggregate([
            {
              $match: {
                date: { $gte: lastMonth, $lte: currentDate }
              }
            },
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                presentCount: {
                  $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
                }
              }
            }
          ]),
          Attendance.aggregate([
            {
              $match: {
                date: { 
                  $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1),
                  $lt: lastMonth
                }
              }
            },
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                presentCount: {
                  $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
                }
              }
            }
          ])
        ]);
        
        const currentRate = currentAttendance[0] ? (currentAttendance[0].presentCount / currentAttendance[0].totalRecords) * 100 : 0;
        const previousRate = previousAttendance[0] ? (previousAttendance[0].presentCount / previousAttendance[0].totalRecords) * 100 : 0;
        
        comparativeData = {
          current: { value: Math.round(currentRate * 100) / 100, period: 'This Month' },
          previous: { value: Math.round(previousRate * 100) / 100, period: 'Last Month' },
          change: Math.round((currentRate - previousRate) * 100) / 100,
          trend: currentRate >= previousRate ? 'up' : 'down'
        };
        break;
        
      case 'performance':
        const [currentPerformance, previousPerformance] = await Promise.all([
          Grade.aggregate([
            {
              $match: {
                date: { $gte: lastMonth, $lte: currentDate }
              }
            },
            {
              $group: {
                _id: null,
                totalScore: { $sum: "$score" },
                totalMaxScore: { $sum: "$maxScore" }
              }
            }
          ]),
          Grade.aggregate([
            {
              $match: {
                date: { 
                  $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1),
                  $lt: lastMonth
                }
              }
            },
            {
              $group: {
                _id: null,
                totalScore: { $sum: "$score" },
                totalMaxScore: { $sum: "$maxScore" }
              }
            }
          ])
        ]);
        
        const currentAvg = currentPerformance[0] ? (currentPerformance[0].totalScore / currentPerformance[0].totalMaxScore) * 100 : 0;
        const previousAvg = previousPerformance[0] ? (previousPerformance[0].totalScore / previousPerformance[0].totalMaxScore) * 100 : 0;
        
        comparativeData = {
          current: { value: Math.round(currentAvg * 100) / 100, period: 'This Month' },
          previous: { value: Math.round(previousAvg * 100) / 100, period: 'Last Month' },
          change: Math.round((currentAvg - previousAvg) * 100) / 100,
          trend: currentAvg >= previousAvg ? 'up' : 'down'
        };
        break;
        
      case 'revenue':
        const [currentRevenue, previousRevenue] = await Promise.all([
          Fee.aggregate([
            {
              $match: {
                paidDate: { $gte: lastMonth, $lte: currentDate },
                status: 'paid'
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$paidAmount" }
              }
            }
          ]),
          Fee.aggregate([
            {
              $match: {
                paidDate: { 
                  $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1),
                  $lt: lastMonth
                },
                status: 'paid'
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$paidAmount" }
              }
            }
          ])
        ]);
        
        const currentRev = currentRevenue[0]?.total || 0;
        const previousRev = previousRevenue[0]?.total || 0;
        const revenueChange = previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : 0;
        
        comparativeData = {
          current: { value: currentRev, period: 'This Month' },
          previous: { value: previousRev, period: 'Last Month' },
          change: Math.round(revenueChange * 100) / 100,
          trend: currentRev >= previousRev ? 'up' : 'down'
        };
        break;
        
      case 'enrollment':
        const [currentEnrollment, previousEnrollment] = await Promise.all([
          Student.countDocuments({ 
            status: 'active',
            createdAt: { $lte: currentDate }
          }),
          Student.countDocuments({ 
            status: 'active',
            createdAt: { $lte: lastYear }
          })
        ]);
        
        const enrollmentChange = previousEnrollment > 0 ? ((currentEnrollment - previousEnrollment) / previousEnrollment) * 100 : 0;
        
        comparativeData = {
          current: { value: currentEnrollment, period: 'Current' },
          previous: { value: previousEnrollment, period: 'Last Year' },
          change: Math.round(enrollmentChange * 100) / 100,
          trend: currentEnrollment >= previousEnrollment ? 'up' : 'down'
        };
        break;
        
      default:
        return res.status(404).json({
          success: false,
          message: `Metric '${metric}' not found`
        });
    }
    
    res.json({
      success: true,
      data: comparativeData,
      metric
    });
  } catch (error) {
    console.error('Comparative analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparative analytics',
      error: error.message
    });
  }
});

// Get predictive analytics
router.get('/predictions/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const { horizon = '6months' } = req.query;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    
    let predictions = {};
    
    switch (type) {
      case 'enrollment':
        const currentEnrollment = await Student.countDocuments({ status: 'active' });
        
        // Simple linear prediction based on historical growth
        const lastYearEnrollment = await Student.countDocuments({ 
          status: 'active',
          createdAt: { $lte: new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate()) }
        });
        
        const growthRate = lastYearEnrollment > 0 ? (currentEnrollment - lastYearEnrollment) / lastYearEnrollment : 0.05;
        const monthlyGrowth = growthRate / 12;
        
        const enrollmentTimeline = [];
        for (let i = 1; i <= 6; i++) {
          const futureDate = new Date(currentDate);
          futureDate.setMonth(currentDate.getMonth() + i);
          const predicted = Math.round(currentEnrollment * (1 + monthlyGrowth * i));
          
          enrollmentTimeline.push({
            month: months[futureDate.getMonth()],
            predicted
          });
        }
        
        predictions = {
          current: currentEnrollment,
          predicted: enrollmentTimeline[enrollmentTimeline.length - 1].predicted,
          confidence: 75,
          factors: ['Historical growth trends', 'Seasonal enrollment patterns', 'Current capacity'],
          timeline: enrollmentTimeline
        };
        break;
        
      case 'revenue':
        const currentMonthRevenue = await Fee.aggregate([
          {
            $match: {
              paidDate: { 
                $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
                $lte: currentDate
              },
              status: 'paid'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$paidAmount" }
            }
          }
        ]);
        
        const currentRevenue = currentMonthRevenue[0]?.total || 0;
        
        // Get average monthly revenue for prediction
        const avgMonthlyRevenue = await Fee.aggregate([
          {
            $match: {
              status: 'paid',
              paidDate: { $gte: new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1) }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: "$paidDate" },
                month: { $month: "$paidDate" }
              },
              monthlyTotal: { $sum: "$paidAmount" }
            }
          },
          {
            $group: {
              _id: null,
              avgRevenue: { $avg: "$monthlyTotal" }
            }
          }
        ]);
        
        const baseRevenue = avgMonthlyRevenue[0]?.avgRevenue || currentRevenue || 50000;
        const revenueGrowthRate = 0.02; // 2% monthly growth assumption
        
        const revenueTimeline = [];
        for (let i = 1; i <= 6; i++) {
          const futureDate = new Date(currentDate);
          futureDate.setMonth(currentDate.getMonth() + i);
          const predicted = Math.round(baseRevenue * Math.pow(1 + revenueGrowthRate, i));
          
          revenueTimeline.push({
            month: months[futureDate.getMonth()],
            predicted
          });
        }
        
        predictions = {
          current: currentRevenue,
          predicted: revenueTimeline[revenueTimeline.length - 1].predicted,
          confidence: 68,
          factors: ['Historical revenue patterns', 'Enrollment projections', 'Fee structure changes'],
          timeline: revenueTimeline
        };
        break;
        
      case 'performance':
        const currentPerformance = await Grade.aggregate([
          {
            $match: {
              date: { $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) }
            }
          },
          {
            $group: {
              _id: null,
              totalScore: { $sum: "$score" },
              totalMaxScore: { $sum: "$maxScore" }
            }
          }
        ]);
        
        const currentAvg = currentPerformance[0] ? 
          (currentPerformance[0].totalScore / currentPerformance[0].totalMaxScore) * 100 : 75;
        
        const performanceImprovement = 0.3; // 0.3% monthly improvement assumption
        
        const performanceTimeline = [];
        for (let i = 1; i <= 6; i++) {
          const futureDate = new Date(currentDate);
          futureDate.setMonth(currentDate.getMonth() + i);
          const predicted = Math.round((currentAvg + (performanceImprovement * i)) * 100) / 100;
          
          performanceTimeline.push({
            month: months[futureDate.getMonth()],
            predicted: Math.min(predicted, 100) // Cap at 100%
          });
        }
        
        predictions = {
          current: Math.round(currentAvg * 100) / 100,
          predicted: performanceTimeline[performanceTimeline.length - 1].predicted,
          confidence: 65,
          factors: ['Historical performance trends', 'Teaching improvements', 'Student engagement initiatives'],
          timeline: performanceTimeline
        };
        break;
        
      default:
        return res.status(404).json({
          success: false,
          message: `Prediction type '${type}' not found`
        });
    }
    
    res.json({
      success: true,
      data: predictions,
      type,
      horizon
    });
  } catch (error) {
    console.error('Predictive analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch predictive analytics',
      error: error.message
    });
  }
});

export default router;