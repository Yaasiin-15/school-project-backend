import express from 'express';
import { body, validationResult, query } from 'express-validator';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import { generateId } from '../utils/helpers.js';

const router = express.Router();

// Validation middleware
const validateParent = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('children').isArray({ min: 1 }).withMessage('At least one child must be linked'),
  body('children.*.studentId').isMongoId().withMessage('Valid student ID is required'),
  body('children.*.relationship').isIn(['father', 'mother', 'guardian', 'other']).withMessage('Valid relationship is required')
];

// Get all parents with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const parents = await Parent.find(filter)
      .populate('children.studentId', 'name studentId class section')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Parent.countDocuments(filter);

    res.json({
      success: true,
      data: parents,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching parents',
      error: error.message
    });
  }
});

// Get parent by ID
router.get('/:id', async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id)
      .populate('children.studentId', 'name studentId class section rollNumber')
      .populate('userId', 'name email profileImage');

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    res.json({
      success: true,
      data: parent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching parent',
      error: error.message
    });
  }
});

// Create new parent
router.post('/', validateParent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if parent already exists
    const existingParent = await Parent.findOne({
      $or: [
        { email: req.body.email },
        { phone: req.body.phone }
      ]
    });

    if (existingParent) {
      return res.status(400).json({
        success: false,
        message: 'Parent with this email or phone already exists'
      });
    }

    // Verify all children exist
    const childrenIds = req.body.children.map(child => child.studentId);
    const students = await Student.find({ _id: { $in: childrenIds } });
    
    if (students.length !== childrenIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more students not found'
      });
    }

    // Create user account for parent
    const userData = {
      name: req.body.name,
      email: req.body.email,
      password: req.body.password || 'parent123', // Default password
      role: 'parent',
      parentId: generateId('PAR')
    };

    const user = new User(userData);
    await user.save();

    // Create parent profile
    const parentData = {
      ...req.body,
      userId: user._id,
      parentId: user.parentId
    };

    const parent = new Parent(parentData);
    await parent.save();

    // Populate the response
    await parent.populate('children.studentId', 'name studentId class section');
    await parent.populate('userId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Parent created successfully',
      data: parent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating parent',
      error: error.message
    });
  }
});

// Update parent
router.put('/:id', validateParent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Check for duplicate email/phone (excluding current parent)
    const existingParent = await Parent.findOne({
      _id: { $ne: req.params.id },
      $or: [
        { email: req.body.email },
        { phone: req.body.phone }
      ]
    });

    if (existingParent) {
      return res.status(400).json({
        success: false,
        message: 'Parent with this email or phone already exists'
      });
    }

    // Update parent
    Object.assign(parent, req.body);
    await parent.save();

    // Update associated user account
    await User.findByIdAndUpdate(parent.userId, {
      name: req.body.name,
      email: req.body.email
    });

    await parent.populate('children.studentId', 'name studentId class section');
    await parent.populate('userId', 'name email');

    res.json({
      success: true,
      message: 'Parent updated successfully',
      data: parent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating parent',
      error: error.message
    });
  }
});

// Delete parent (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Soft delete parent
    parent.status = 'inactive';
    await parent.save();

    // Deactivate user account
    await User.findByIdAndUpdate(parent.userId, { isActive: false });

    res.json({
      success: true,
      message: 'Parent deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting parent',
      error: error.message
    });
  }
});

// Link child to parent
router.post('/:id/link-child', async (req, res) => {
  try {
    const { studentId, relationship } = req.body;

    if (!studentId || !relationship) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and relationship are required'
      });
    }

    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if child is already linked
    const existingChild = parent.children.find(child => 
      child.studentId.toString() === studentId
    );

    if (existingChild) {
      return res.status(400).json({
        success: false,
        message: 'Child is already linked to this parent'
      });
    }

    parent.children.push({ studentId, relationship });
    await parent.save();

    await parent.populate('children.studentId', 'name studentId class section');

    res.json({
      success: true,
      message: 'Child linked successfully',
      data: parent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error linking child',
      error: error.message
    });
  }
});

// Unlink child from parent
router.delete('/:id/unlink-child/:studentId', async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    parent.children = parent.children.filter(child => 
      child.studentId.toString() !== req.params.studentId
    );

    await parent.save();

    res.json({
      success: true,
      message: 'Child unlinked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unlinking child',
      error: error.message
    });
  }
});

// Get parent's children progress
router.get('/:id/children-progress', async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id)
      .populate('children.studentId', 'name studentId class section');

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Get progress data for each child
    const childrenProgress = await Promise.all(
      parent.children.map(async (child) => {
        const studentId = child.studentId._id;
        
        // Get recent grades
        const Grade = (await import('../models/Grade.js')).default;
        const recentGrades = await Grade.find({ student: studentId })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('subject', 'name');

        // Get attendance summary
        const Attendance = (await import('../models/Attendance.js')).default;
        const attendanceStats = await Attendance.aggregate([
          { $match: { student: studentId } },
          {
            $group: {
              _id: null,
              totalDays: { $sum: 1 },
              presentDays: {
                $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
              }
            }
          }
        ]);

        const attendancePercentage = attendanceStats.length > 0 
          ? Math.round((attendanceStats[0].presentDays / attendanceStats[0].totalDays) * 100)
          : 0;

        return {
          student: child.studentId,
          relationship: child.relationship,
          recentGrades,
          attendancePercentage,
          attendanceStats: attendanceStats[0] || { totalDays: 0, presentDays: 0 }
        };
      })
    );

    res.json({
      success: true,
      data: childrenProgress
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching children progress',
      error: error.message
    });
  }
});

// Update parent preferences
router.put('/:id/preferences', async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    parent.preferences = { ...parent.preferences, ...req.body };
    await parent.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: parent.preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating preferences',
      error: error.message
    });
  }
});

export default router;