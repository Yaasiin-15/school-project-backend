import express from 'express';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Mock data for demonstration
let transactions = [
  {
    _id: '1',
    studentId: 'STU001',
    studentName: 'John Doe',
    amount: 5000,
    feeType: 'Tuition Fee',
    status: 'paid',
    date: new Date(),
    paymentMethod: 'Bank Transfer',
    invoiceNumber: 'INV-001'
  },
  {
    _id: '2',
    studentId: 'STU002',
    studentName: 'Jane Smith',
    amount: 3000,
    feeType: 'Library Fee',
    status: 'pending',
    date: new Date(Date.now() - 86400000),
    paymentMethod: 'Cash',
    invoiceNumber: 'INV-002'
  },
  {
    _id: '3',
    studentId: 'STU003',
    studentName: 'Mike Johnson',
    amount: 7500,
    feeType: 'Annual Fee',
    status: 'overdue',
    date: new Date(Date.now() - 2592000000),
    paymentMethod: 'Online',
    invoiceNumber: 'INV-003'
  }
];

const feeStructure = [
  {
    _id: '1',
    class: 'Grade 1-5',
    tuitionFee: 5000,
    libraryFee: 500,
    labFee: 300,
    sportsFee: 200
  },
  {
    _id: '2',
    class: 'Grade 6-8',
    tuitionFee: 6000,
    libraryFee: 600,
    labFee: 400,
    sportsFee: 300
  },
  {
    _id: '3',
    class: 'Grade 9-10',
    tuitionFee: 7000,
    libraryFee: 700,
    labFee: 500,
    sportsFee: 400
  }
];

// Get finance dashboard data
router.get('/dashboard', auth, async (req, res) => {
  try {
    const totalCollected = transactions
      .filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalPending = transactions
      .filter(t => t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const overdueAmount = transactions
      .filter(t => t.status === 'overdue')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const currentMonth = new Date().getMonth();
    const monthlyRevenue = transactions
      .filter(t => t.status === 'paid' && new Date(t.date).getMonth() === currentMonth)
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Generate monthly revenue data for the last 6 months
    const monthlyRevenueData = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const revenue = Math.floor(Math.random() * 20000) + 30000; // Mock data
      monthlyRevenueData.push({
        month: months[monthIndex],
        revenue
      });
    }
    
    res.json({
      success: true,
      data: {
        stats: {
          totalCollected,
          totalPending,
          monthlyRevenue,
          overdueAmount
        },
        monthlyRevenue: monthlyRevenueData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch finance dashboard data',
      error: error.message
    });
  }
});

// Get all transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const { status, studentId, page = 1, limit = 50 } = req.query;
    
    let filteredTransactions = [...transactions];
    
    if (status && status !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.status === status);
    }
    
    if (studentId) {
      filteredTransactions = filteredTransactions.filter(t => t.studentId === studentId);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredTransactions.length / limit),
        totalTransactions: filteredTransactions.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// Create new transaction
router.post('/transactions', auth, async (req, res) => {
  try {
    const { studentId, studentName, amount, feeType, paymentMethod } = req.body;
    
    const newTransaction = {
      _id: Date.now().toString(),
      studentId,
      studentName,
      amount: parseFloat(amount),
      feeType,
      status: 'paid',
      date: new Date(),
      paymentMethod,
      invoiceNumber: `INV-${Date.now()}`
    };
    
    transactions.push(newTransaction);
    
    res.status(201).json({
      success: true,
      data: newTransaction,
      message: 'Transaction created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
});

// Update transaction status
router.put('/transactions/:transactionId', auth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, paymentMethod } = req.body;
    
    const transactionIndex = transactions.findIndex(t => t._id === transactionId);
    if (transactionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    transactions[transactionIndex] = {
      ...transactions[transactionIndex],
      status,
      paymentMethod,
      updatedAt: new Date()
    };
    
    res.json({
      success: true,
      data: transactions[transactionIndex],
      message: 'Transaction updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction',
      error: error.message
    });
  }
});

// Get fee structure
router.get('/fee-structure', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: feeStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure',
      error: error.message
    });
  }
});

// Update fee structure
router.put('/fee-structure/:feeId', auth, async (req, res) => {
  try {
    const { feeId } = req.params;
    const updates = req.body;
    
    const feeIndex = feeStructure.findIndex(f => f._id === feeId);
    if (feeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }
    
    feeStructure[feeIndex] = { ...feeStructure[feeIndex], ...updates };
    
    res.json({
      success: true,
      data: feeStructure[feeIndex],
      message: 'Fee structure updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update fee structure',
      error: error.message
    });
  }
});

// Generate invoice
router.post('/invoice/:studentId', auth, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // In a real application, you would generate a PDF invoice here
    // For now, we'll just return a success message
    const invoiceData = {
      invoiceNumber: `INV-${Date.now()}`,
      studentId,
      generatedAt: new Date(),
      downloadUrl: `/api/finance/invoice/${studentId}/download`
    };
    
    res.json({
      success: true,
      data: invoiceData,
      message: 'Invoice generated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  }
});

// Get financial reports
router.get('/reports', auth, async (req, res) => {
  try {
    const { type = 'monthly', year = new Date().getFullYear() } = req.query;
    
    // Mock report data
    const reportData = {
      type,
      year: parseInt(year),
      totalRevenue: transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0),
      totalPending: transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0),
      totalOverdue: transactions.filter(t => t.status === 'overdue').reduce((sum, t) => sum + t.amount, 0),
      monthlyBreakdown: [
        { month: 'January', collected: 45000, pending: 12000 },
        { month: 'February', collected: 38000, pending: 8000 },
        { month: 'March', collected: 52000, pending: 15000 }
      ]
    };
    
    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate financial report',
      error: error.message
    });
  }
});

// Delete transaction
router.delete('/transactions/:transactionId', auth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transactionIndex = transactions.findIndex(t => t._id === transactionId);
    if (transactionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    transactions.splice(transactionIndex, 1);
    
    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
      error: error.message
    });
  }
});

export default router;