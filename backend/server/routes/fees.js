import express from 'express';
import Fee from '../models/Fee.js';
import Student from '../models/Student.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/fees
// @desc    Get all fees with filtering
// @access  Private
router.get('/', authorize('admin', 'accountant', 'teacher'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      studentId,
      status,
      type,
      term
    } = req.query;

    const query = {};
    
    if (studentId && studentId !== 'all') {
      query.studentId = studentId;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (term && term !== 'all') {
      query.term = term;
    }
    
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const fees = await Fee.find(query)
      .populate('studentId', 'name studentId email avatar')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ dueDate: -1 });

    const total = await Fee.countDocuments(query);

    res.json({
      success: true,
      data: {
        fees,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalFees: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fees',
      error: error.message
    });
  }
});

// @route   GET /api/fees/:id
// @desc    Get fee by ID
// @access  Private
router.get('/:id', authorize('admin', 'accountant', 'teacher', 'student', 'parent'), async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate('studentId', 'name studentId email avatar class section');
    
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    res.json({
      success: true,
      data: { fee }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee',
      error: error.message
    });
  }
});

// @route   POST /api/fees
// @desc    Create new fee
// @access  Private (Admin, Accountant)
router.post('/', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const {
      studentId,
      type,
      amount,
      dueDate,
      term,
      academicYear,
      discount,
      description
    } = req.body;

    // Get student information
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const fee = new Fee({
      studentId,
      studentName: student.name,
      studentClass: student.class,
      type,
      amount,
      dueDate,
      term,
      academicYear,
      discount,
      description
    });

    await fee.save();

    res.status(201).json({
      success: true,
      message: 'Fee created successfully',
      data: { fee }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create fee',
      error: error.message
    });
  }
});

// @route   PUT /api/fees/:id
// @desc    Update fee
// @access  Private (Admin, Accountant)
router.put('/:id', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const fee = await Fee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    res.json({
      success: true,
      message: 'Fee updated successfully',
      data: { fee }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update fee',
      error: error.message
    });
  }
});

// @route   DELETE /api/fees/:id
// @desc    Delete fee
// @access  Private (Admin, Accountant)
router.delete('/:id', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const fee = await Fee.findByIdAndDelete(req.params.id);
    
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    res.json({
      success: true,
      message: 'Fee deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete fee',
      error: error.message
    });
  }
});

// @route   POST /api/fees/:id/payment
// @desc    Process fee payment
// @access  Private (Admin, Accountant, Parent)
router.post('/:id/payment', authorize('admin', 'accountant', 'parent'), async (req, res) => {
  try {
    const { amount, paymentMethod, transactionId } = req.body;
    
    const fee = await Fee.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    const totalAmount = fee.amount + fee.lateFee - fee.discount;
    const remainingAmount = totalAmount - fee.paidAmount;

    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds remaining balance'
      });
    }

    // Add to payment history
    fee.paymentHistory.push({
      amount: parseFloat(amount),
      date: new Date(),
      method: paymentMethod,
      transactionId,
      receivedBy: req.user.name
    });

    // Update payment details
    fee.paidAmount += parseFloat(amount);
    fee.paymentMethod = paymentMethod;
    fee.transactionId = transactionId;
    
    if (fee.paidAmount === 0) {
      fee.paidDate = null;
    } else if (!fee.paidDate || fee.paidAmount >= totalAmount) {
      fee.paidDate = new Date();
    }

    await fee.save();

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: { fee }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
});

// @route   GET /api/fees/analytics/overview
// @desc    Get fee analytics overview
// @access  Private (Admin, Accountant)
router.get('/analytics/overview', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { academicYear, term } = req.query;

    const query = {};
    if (academicYear) query.academicYear = academicYear;
    if (term) query.term = term;

    const fees = await Fee.find(query);

    // Calculate statistics
    const totalFees = fees.length;
    const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const totalPaid = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const totalPending = totalAmount - totalPaid;

    // Status distribution
    const statusDistribution = {};
    fees.forEach(fee => {
      statusDistribution[fee.status] = (statusDistribution[fee.status] || 0) + 1;
    });

    // Type distribution
    const typeDistribution = {};
    fees.forEach(fee => {
      typeDistribution[fee.type] = (typeDistribution[fee.type] || 0) + 1;
    });

    // Monthly collection
    const monthlyCollection = {};
    fees.forEach(fee => {
      if (fee.paidDate) {
        const month = fee.paidDate.toISOString().substring(0, 7);
        monthlyCollection[month] = (monthlyCollection[month] || 0) + fee.paidAmount;
      }
    });

    res.json({
      success: true,
      data: {
        totalFees,
        totalAmount,
        totalPaid,
        totalPending,
        collectionRate: totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0,
        statusDistribution,
        typeDistribution,
        monthlyCollection
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get fee analytics',
      error: error.message
    });
  }
});

// @route   GET /api/fees/analytics/student/:studentId
// @desc    Get student fee analytics
// @access  Private
router.get('/analytics/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear } = req.query;

    const query = { studentId };
    if (academicYear) query.academicYear = academicYear;

    const fees = await Fee.find(query);

    const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const totalPaid = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const totalPending = totalAmount - totalPaid;

    const statusDistribution = {};
    fees.forEach(fee => {
      statusDistribution[fee.status] = (statusDistribution[fee.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalFees: fees.length,
        totalAmount,
        totalPaid,
        totalPending,
        statusDistribution,
        fees
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get student fee analytics',
      error: error.message
    });
  }
});

export default router;