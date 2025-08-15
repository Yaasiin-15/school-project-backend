import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import authMiddleware from '../middleware/auth.js';
import { validateUserRegistration, validateUserLogin } from '../middleware/validation.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateUserRegistration, async (req, res) => {
  try {
    const { name, email, password, role, additionalInfo } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      role
    });

    // Generate unique IDs based on role
    if (role === 'student') {
      const studentCount = await User.countDocuments({ role: 'student' });
      user.studentId = `S${String(studentCount + 1).padStart(3, '0')}`;
    } else if (role === 'teacher') {
      const teacherCount = await User.countDocuments({ role: 'teacher' });
      user.teacherId = `T${String(teacherCount + 1).padStart(3, '0')}`;
    } else if (role === 'parent') {
      const parentCount = await User.countDocuments({ role: 'parent' });
      user.parentId = `P${String(parentCount + 1).padStart(3, '0')}`;
    } else if (role === 'accountant') {
      const accountantCount = await User.countDocuments({ role: 'accountant' });
      user.accountantId = `A${String(accountantCount + 1).padStart(3, '0')}`;
    }

    await user.save();

    // Create role-specific records
    if (role === 'student' && additionalInfo) {
      const student = new Student({
        userId: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        ...additionalInfo
      });
      await student.save();
    } else if (role === 'teacher' && additionalInfo) {
      const teacher = new Teacher({
        userId: user._id,
        teacherId: user.teacherId,
        name: user.name,
        email: user.email,
        ...additionalInfo
      });
      await teacher.save();
    }

    // Generate token
    const token = generateToken(user._id);

    // Log user registration
    logger.info('New user registered', {
      userId: user._id,
      email: user.email,
      role: user.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send welcome email (don't wait for it to complete)
    emailService.sendWelcomeEmail(user).catch(error => {
      logger.error('Failed to send welcome email', error, { userId: user._id });
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Debug logging
    console.log('Login attempt:', { email, hasPassword: !!password });

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('User not found for email:', email);
      logger.warn('Login attempt with non-existent email', { email, ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    console.log('User found:', { id: user._id, email: user.email, role: user.role });

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Log successful login
    logger.audit(user._id, 'LOGIN', 'AUTH', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          studentId: user.studentId,
          teacherId: user.teacherId,
          parentId: user.parentId,
          accountantId: user.accountantId
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user info',
      error: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authMiddleware, async (_req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just send a success response
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
});

// @route   POST /api/auth/create-initial-admin
// @desc    Create initial admin user (for setup)
// @access  Public (only if no admin exists)
router.post('/create-initial-admin', async (req, res) => {
  try {
    // Check if any admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists'
      });
    }

    const { name, email, password } = req.body;

    const admin = new User({
      name,
      email,
      password,
      role: 'admin'
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Initial admin user created successfully',
      data: {
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create admin user',
      error: error.message
    });
  }
});

export default router;