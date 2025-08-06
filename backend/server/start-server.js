import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 Starting server initialization...');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

console.log('✅ Basic middleware configured');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'School Management API is running',
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Health check route configured');

// Try to import and configure routes one by one
try {
  console.log('📦 Importing auth routes...');
  const { default: authRoutes } = await import('./routes/auth.js');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes configured');
} catch (error) {
  console.error('❌ Failed to import auth routes:', error.message);
}

try {
  console.log('📦 Importing middleware...');
  const { default: authMiddleware } = await import('./middleware/auth.js');
  console.log('✅ Auth middleware imported');
  
  console.log('📦 Importing dashboard routes...');
  const { default: dashboardRoutes } = await import('./routes/dashboard.js');
  app.use('/api/dashboard', authMiddleware, dashboardRoutes);
  console.log('✅ Dashboard routes configured');
} catch (error) {
  console.error('❌ Failed to import dashboard routes:', error.message);
}

try {
  console.log('📦 Importing student routes...');
  const { default: studentRoutes } = await import('./routes/students.js');
  const { default: authMiddleware } = await import('./middleware/auth.js');
  app.use('/api/students', authMiddleware, studentRoutes);
  console.log('✅ Student routes configured');
} catch (error) {
  console.error('❌ Failed to import student routes:', error.message);
}

try {
  console.log('📦 Importing analytics routes...');
  const { default: analyticsRoutes } = await import('./routes/analytics.js');
  const { default: authMiddleware } = await import('./middleware/auth.js');
  app.use('/api/analytics', authMiddleware, analyticsRoutes);
  console.log('✅ Analytics routes configured');
} catch (error) {
  console.error('❌ Failed to import analytics routes:', error.message);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
});