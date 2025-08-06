import express from 'express';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Mock data for demonstration
let exams = [
  {
    _id: '1',
    title: 'Mid-term Mathematics Exam',
    subject: 'Mathematics',
    class: 'Grade 10-A',
    date: new Date('2024-03-15'),
    duration: 90,
    maxMarks: 100,
    instructions: 'Answer all questions. Show your work clearly.',
    createdBy: 'teacher1',
    students: [
      { _id: 'student1', name: 'John Doe', studentId: 'STU001', marks: 85 },
      { _id: 'student2', name: 'Jane Smith', studentId: 'STU002', marks: 92 }
    ]
  },
  {
    _id: '2',
    title: 'Science Lab Test',
    subject: 'Science',
    class: 'Grade 9-B',
    date: new Date('2024-03-20'),
    duration: 60,
    maxMarks: 50,
    instructions: 'Practical examination. Follow safety protocols.',
    createdBy: 'teacher2',
    students: [
      { _id: 'student3', name: 'Mike Johnson', studentId: 'STU003', marks: 45 },
      { _id: 'student4', name: 'Sarah Wilson', studentId: 'STU004', marks: 48 }
    ]
  }
];

// Get all exams
router.get('/', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      data: exams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exams',
      error: error.message
    });
  }
});

// Create new exam
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, subject, class: className, date, duration, maxMarks, instructions } = req.body;
    
    const newExam = {
      _id: Date.now().toString(),
      title,
      subject,
      class: className,
      date: new Date(date),
      duration: parseInt(duration),
      maxMarks: parseInt(maxMarks),
      instructions,
      createdBy: req.user.id,
      students: []
    };
    
    exams.push(newExam);
    
    res.status(201).json({
      success: true,
      data: newExam,
      message: 'Exam created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create exam',
      error: error.message
    });
  }
});

// Get students for an exam
router.get('/:examId/students', authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = exams.find(e => e._id === examId);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Mock students data - in real app, fetch from database based on class
    const students = [
      { _id: 'student1', name: 'John Doe', studentId: 'STU001', marks: exam.students.find(s => s._id === 'student1')?.marks || '' },
      { _id: 'student2', name: 'Jane Smith', studentId: 'STU002', marks: exam.students.find(s => s._id === 'student2')?.marks || '' },
      { _id: 'student3', name: 'Mike Johnson', studentId: 'STU003', marks: exam.students.find(s => s._id === 'student3')?.marks || '' },
      { _id: 'student4', name: 'Sarah Wilson', studentId: 'STU004', marks: exam.students.find(s => s._id === 'student4')?.marks || '' }
    ];
    
    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// Save marks for an exam
router.post('/:examId/marks', authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const { marks } = req.body;
    
    const examIndex = exams.findIndex(e => e._id === examId);
    if (examIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Update marks for students
    const updatedStudents = [];
    for (const [studentId, mark] of Object.entries(marks)) {
      if (mark !== '') {
        updatedStudents.push({
          _id: studentId,
          marks: parseInt(mark)
        });
      }
    }
    
    exams[examIndex].students = updatedStudents;
    
    res.json({
      success: true,
      message: 'Marks saved successfully',
      data: exams[examIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save marks',
      error: error.message
    });
  }
});

// Generate report cards
router.post('/:examId/report-cards', authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = exams.find(e => e._id === examId);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // In a real application, you would generate PDF report cards here
    // For now, we'll just return a success message
    res.json({
      success: true,
      message: 'Report cards generated successfully',
      downloadUrl: `/api/exams/${examId}/report-cards/download`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate report cards',
      error: error.message
    });
  }
});

// Update exam
router.put('/:examId', authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const updates = req.body;
    
    const examIndex = exams.findIndex(e => e._id === examId);
    if (examIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    exams[examIndex] = { ...exams[examIndex], ...updates };
    
    res.json({
      success: true,
      data: exams[examIndex],
      message: 'Exam updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update exam',
      error: error.message
    });
  }
});

// Delete exam
router.delete('/:examId', authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    
    const examIndex = exams.findIndex(e => e._id === examId);
    if (examIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    exams.splice(examIndex, 1);
    
    res.json({
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete exam',
      error: error.message
    });
  }
});

export default router;