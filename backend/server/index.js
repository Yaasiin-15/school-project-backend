import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import teacherRoutes from './routes/teachers.js';
import classRoutes from './routes/classes.js';
import gradeRoutes from './routes/grades.js';
import feeRoutes from './routes/fees.js';
import announcementRoutes from './routes/announcements.js';
import dashboardRoutes from './routes/dashboard.js';
import attendanceRoutes from './routes/attendance.js';
import usersRoutes from './routes/users.js';
import uploadRoutes from './routes/upload.js';
import examRoutes from './routes/exams.js';
import financeRoutes from './routes/finance.js';
import messageRoutes from './routes/messages.js';
import resourceRoutes from './routes/resources.js';
import analyticsRoutes from './routes/analytics.js';
import promotionRoutes from './routes/promotions.js';
import feeReminderRoutes from './routes/feeReminders.js';
import timetableRoutes from './routes/timetable.js';

// Import middleware
import authMiddleware from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';

// Import utilities
import logger from './utils/logger.js';
import connectDatabase from './config/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Production Security Middleware
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    }
  });
  app.use('/api/', limiter);

  // Compression
  app.use(compression());

  // Logging
  app.use(morgan('combined'));
} else {
  // Development logging
  app.use(morgan('dev'));
}

// CORS Configuration - Allow all origins for now
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins for now
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
    authorization: req.headers.authorization ? 'Present' : 'Missing'
  });
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'School Management API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/teachers', authMiddleware, teacherRoutes);
app.use('/api/classes', authMiddleware, classRoutes);
app.use('/api/grades', authMiddleware, gradeRoutes);
app.use('/api/fees', authMiddleware, feeRoutes);
app.use('/api/announcements', authMiddleware, announcementRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/attendance', authMiddleware, attendanceRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/exams', authMiddleware, examRoutes);
app.use('/api/finance', authMiddleware, financeRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/resources', authMiddleware, resourceRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/promotions', authMiddleware, promotionRoutes);
app.use('/api/fee-reminders', authMiddleware, feeReminderRoutes);
app.use('/api/timetable', authMiddleware, timetableRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection and server startup
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server started successfully`, {
        port: PORT,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
        console.log(`📝 Health Check: http://localhost:${PORT}/health`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

export default app;