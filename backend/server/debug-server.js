import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Simple CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Debug server is running',
    timestamp: new Date().toISOString()
  });
});

// Simple grades endpoint
app.get('/api/grades', (req, res) => {
  res.json({
    success: true,
    data: {
      grades: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalGrades: 0
      }
    }
  });
});

app.post('/api/grades', (req, res) => {
  console.log('POST /api/grades received:', req.body);
  res.json({
    success: true,
    message: 'Grade created successfully (debug)',
    data: { grade: { _id: 'debug123', ...req.body } }
  });
});

app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
});