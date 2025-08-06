import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://school-project-frontend-snowy.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Test server is running',
    timestamp: new Date().toISOString()
  });
});

// Test auth route
app.post('/api/auth/login', (req, res) => {
  // Mock login for testing
  const { email, password } = req.body;
  
  if (email === 'admin@school.com' && password === 'admin123') {
    res.json({
      success: true,
      data: {
        user: {
          _id: '1',
          name: 'Admin User',
          email: 'admin@school.com',
          role: 'admin'
        },
        token: 'mock-jwt-token'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📝 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔐 Test Login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   Email: admin@school.com`);
  console.log(`   Password: admin123`);
});