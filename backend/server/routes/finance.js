import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Fee from '../models/Fee.js';
import Student from '../models/Student.js';

const router = express.Router();

// Get finance dashboard data
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Get financial statistics
    const [totalCollected, totalPending, overdueAmount, monthlyRevenue] = await Promise.all([
      Fee.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } }
      ]),
      Fee.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
      ]),
      Fee.aggregate([
        { $match: { status: 'overdue' } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
      ]),
      Fee.aggregate([
        {
          $match: {
            status: 'paid',
            paidDate: {
              $gte: new Date(currentYear, currentMonth, 1),
              $lte: currentDate
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } }
      ])
    ]);

    // Generate monthly revenue data for the last 6 months
    const monthlyRevenueData = await Fee.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: {
            $gte: new Date(currentYear, currentMonth - 5, 1),
            $lte: currentDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidDate' },
            month: { $month: '$paidDate' }
          },
          revenue: { $sum: '$paidAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Format monthly data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonthlyData = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - i, 1);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth() + 1;

      const monthData = monthlyRevenueData.find(
        item => item._id.year === targetYear && item._id.month === targetMonth
      );

      formattedMonthlyData.push({
        month: months[targetDate.getMonth()],
        revenue: monthData ? monthData.revenue : 0
      });
    }

    res.json({
      success: true,
      data: {
        stats: {
          totalCollected: totalCollected[0]?.total || 0,
          totalPending: totalPending[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
          overdueAmount: overdueAmount[0]?.total || 0
        },
        monthlyRevenue: formattedMonthlyData
      }
    });
  } catch (error) {
    console.error('Finance dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch finance dashboard data',
      error: error.message
    });
  }
});

// Get all transactions
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const { status, studentId, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (studentId) {
      query.studentId = studentId;
    }

    const [fees, totalCount] = await Promise.all([
      Fee.find(query)
        .populate('studentId', 'name studentId')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit),
      Fee.countDocuments(query)
    ]);

    // Format transactions
    const transactions = fees.map(fee => ({
      _id: fee._id,
      studentId: fee.studentId?.studentId || fee.studentId,
      studentName: fee.studentName,
      amount: fee.amount,
      paidAmount: fee.paidAmount,
      feeType: fee.type,
      status: fee.status,
      date: fee.createdAt,
      dueDate: fee.dueDate,
      paidDate: fee.paidDate,
      paymentMethod: fee.paymentMethod,
      invoiceNumber: fee.invoiceNumber,
      term: fee.term,
      discount: fee.discount,
      lateFee: fee.lateFee
    }));

    res.json({
      success: true,
      data: transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalTransactions: totalCount
      }
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// Create new fee/transaction
router.post('/transactions', authMiddleware, async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      studentClass,
      amount,
      feeType,
      paymentMethod,
      dueDate,
      term = 'Current Term',
      discount = 0,
      description
    } = req.body;

    // Validate student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const newFee = new Fee({
      studentId,
      studentName: studentName || student.name,
      studentClass: studentClass || student.class,
      type: feeType,
      amount: parseFloat(amount),
      paidAmount: paymentMethod ? parseFloat(amount) : 0, // If payment method provided, mark as paid
      dueDate: new Date(dueDate),
      paidDate: paymentMethod ? new Date() : null,
      status: paymentMethod ? 'paid' : 'pending',
      term,
      discount: parseFloat(discount) || 0,
      paymentMethod: paymentMethod || null,
      description,
      paymentHistory: paymentMethod ? [{
        amount: parseFloat(amount),
        date: new Date(),
        method: paymentMethod,
        receivedBy: req.user.name || 'Admin'
      }] : []
    });

    await newFee.save();

    res.status(201).json({
      success: true,
      data: {
        _id: newFee._id,
        studentId: newFee.studentId,
        studentName: newFee.studentName,
        amount: newFee.amount,
        paidAmount: newFee.paidAmount,
        feeType: newFee.type,
        status: newFee.status,
        date: newFee.createdAt,
        dueDate: newFee.dueDate,
        paidDate: newFee.paidDate,
        paymentMethod: newFee.paymentMethod,
        invoiceNumber: newFee.invoiceNumber
      },
      message: 'Fee record created successfully'
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
});

// Update transaction/fee status
router.put('/transactions/:transactionId', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, paymentMethod, paidAmount, remarks } = req.body;

    const fee = await Fee.findById(transactionId);
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const updateData = {};

    if (status) updateData.status = status;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (paidAmount !== undefined) {
      updateData.paidAmount = parseFloat(paidAmount);
      updateData.paidDate = new Date();

      // Add to payment history
      fee.paymentHistory.push({
        amount: parseFloat(paidAmount),
        date: new Date(),
        method: paymentMethod || 'cash',
        receivedBy: req.user.name || 'Admin'
      });
    }
    if (remarks) updateData.remarks = remarks;

    const updatedFee = await Fee.findByIdAndUpdate(
      transactionId,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      data: {
        _id: updatedFee._id,
        studentId: updatedFee.studentId,
        studentName: updatedFee.studentName,
        amount: updatedFee.amount,
        paidAmount: updatedFee.paidAmount,
        feeType: updatedFee.type,
        status: updatedFee.status,
        date: updatedFee.createdAt,
        dueDate: updatedFee.dueDate,
        paidDate: updatedFee.paidDate,
        paymentMethod: updatedFee.paymentMethod,
        invoiceNumber: updatedFee.invoiceNumber
      },
      message: 'Transaction updated successfully'
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction',
      error: error.message
    });
  }
});

// Get fee structure (based on actual fee types in database)
router.get('/fee-structure', authMiddleware, async (req, res) => {
  try {
    // Get fee structure from actual database data
    const feeTypes = await Fee.aggregate([
      {
        $group: {
          _id: {
            type: '$type',
            studentClass: '$studentClass'
          },
          averageAmount: { $avg: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.studentClass',
          fees: {
            $push: {
              type: '$_id.type',
              averageAmount: { $round: ['$averageAmount', 2] },
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Format the data
    const feeStructure = feeTypes.map(classData => {
      const structure = {
        _id: classData._id,
        class: classData._id || 'General',
      };

      classData.fees.forEach(fee => {
        structure[fee.type] = fee.averageAmount;
      });

      return structure;
    });

    // If no data exists, return default structure
    if (feeStructure.length === 0) {
      const defaultStructure = [
        {
          _id: '1',
          class: 'Grade 1-5',
          tuition: 5000,
          library: 500,
          lab: 300,
          sports: 200
        },
        {
          _id: '2',
          class: 'Grade 6-8',
          tuition: 6000,
          library: 600,
          lab: 400,
          sports: 300
        },
        {
          _id: '3',
          class: 'Grade 9-10',
          tuition: 7000,
          library: 700,
          lab: 500,
          sports: 400
        }
      ];

      return res.json({
        success: true,
        data: defaultStructure,
        message: 'Default fee structure (no data in database)'
      });
    }

    res.json({
      success: true,
      data: feeStructure
    });
  } catch (error) {
    console.error('Fetch fee structure error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure',
      error: error.message
    });
  }
});

// Generate invoice
router.post('/invoice/:studentId', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student information
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all fees for the student
    const fees = await Fee.find({ studentId })
      .sort({ createdAt: -1 });

    const invoiceData = {
      invoiceNumber: `INV-${Date.now()}`,
      studentId,
      studentName: student.name,
      studentClass: student.class,
      generatedAt: new Date(),
      fees: fees.map(fee => ({
        type: fee.type,
        amount: fee.amount,
        paidAmount: fee.paidAmount,
        status: fee.status,
        dueDate: fee.dueDate,
        invoiceNumber: fee.invoiceNumber
      })),
      totalAmount: fees.reduce((sum, fee) => sum + fee.amount, 0),
      totalPaid: fees.reduce((sum, fee) => sum + fee.paidAmount, 0),
      totalDue: fees.reduce((sum, fee) => sum + (fee.amount - fee.paidAmount), 0),
      downloadUrl: `/api/finance/invoice/${studentId}/download`
    };

    res.json({
      success: true,
      data: invoiceData,
      message: 'Invoice generated successfully'
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  }
});

// Get financial reports
router.get('/reports', authMiddleware, async (req, res) => {
  try {
    const { type = 'monthly', year = new Date().getFullYear() } = req.query;
    const targetYear = parseInt(year);

    // Get yearly totals
    const [totalRevenue, totalPending, totalOverdue] = await Promise.all([
      Fee.aggregate([
        {
          $match: {
            status: 'paid',
            paidDate: {
              $gte: new Date(targetYear, 0, 1),
              $lte: new Date(targetYear, 11, 31)
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } }
      ]),
      Fee.aggregate([
        {
          $match: {
            status: 'pending',
            createdAt: {
              $gte: new Date(targetYear, 0, 1),
              $lte: new Date(targetYear, 11, 31)
            }
          }
        },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
      ]),
      Fee.aggregate([
        {
          $match: {
            status: 'overdue',
            dueDate: { $lt: new Date() },
            createdAt: {
              $gte: new Date(targetYear, 0, 1),
              $lte: new Date(targetYear, 11, 31)
            }
          }
        },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
      ])
    ]);

    // Get monthly breakdown
    const monthlyData = await Fee.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(targetYear, 0, 1),
            $lte: new Date(targetYear, 11, 31)
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$createdAt' },
            status: '$status'
          },
          amount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'paid'] },
                '$paidAmount',
                { $subtract: ['$amount', '$paidAmount'] }
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: '$_id.month',
          collected: {
            $sum: {
              $cond: [
                { $eq: ['$_id.status', 'paid'] },
                '$amount',
                0
              ]
            }
          },
          pending: {
            $sum: {
              $cond: [
                { $in: ['$_id.status', ['pending', 'overdue']] },
                '$amount',
                0
              ]
            }
          }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Format monthly breakdown
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthlyBreakdown = months.map((month, index) => {
      const data = monthlyData.find(item => item._id === index + 1);
      return {
        month,
        collected: data ? Math.round(data.collected) : 0,
        pending: data ? Math.round(data.pending) : 0
      };
    });

    const reportData = {
      type,
      year: targetYear,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalPending: totalPending[0]?.total || 0,
      totalOverdue: totalOverdue[0]?.total || 0,
      monthlyBreakdown
    };

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Financial reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate financial report',
      error: error.message
    });
  }
});

// Delete transaction
router.delete('/transactions/:transactionId', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const deletedFee = await Fee.findByIdAndDelete(transactionId);

    if (!deletedFee) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      data: {
        deletedTransaction: {
          _id: deletedFee._id,
          studentName: deletedFee.studentName,
          amount: deletedFee.amount,
          type: deletedFee.type,
          invoiceNumber: deletedFee.invoiceNumber
        }
      }
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
      error: error.message
    });
  }
});

export default router;