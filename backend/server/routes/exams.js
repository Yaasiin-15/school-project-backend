import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Exam from '../models/Exam.js';
import Grade from '../models/Grade.js';
import Student from '../models/Student.js';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';

const router = express.Router();

// Get all classes in the school
router.get('/classes', authMiddleware, async (req, res) => {
  try {
    const classes = await Student.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: {
            class: '$class',
            section: '$section'
          },
          className: { $first: { $concat: ['$class', '-', '$section'] } },
          studentCount: { $sum: 1 },
          students: {
            $push: {
              _id: '$_id',
              name: '$name',
              studentId: '$studentId',
              rollNumber: '$rollNumber'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          className: '$className',
          class: '$_id.class',
          section: '$_id.section',
          studentCount: 1,
          students: 1
        }
      },
      { $sort: { class: 1, section: 1 } }
    ]);

    res.json({
      success: true,
      data: classes,
      totalClasses: classes.length,
      totalStudents: classes.reduce((sum, cls) => sum + cls.studentCount, 0)
    });
  } catch (error) {
    console.error('Fetch classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes',
      error: error.message
    });
  }
});

// Get all exams (grades grouped by exam type and subject)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { class: className, subject, examType } = req.query;
    
    const matchQuery = {};
    if (className && className !== 'all') matchQuery.className = className;
    if (subject && subject !== 'all') matchQuery.subjectName = subject;
    if (examType && examType !== 'all') matchQuery.examType = examType;

    const exams = await Grade.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            subject: '$subjectName',
            examType: '$examType',
            class: '$className',
            date: '$date'
          },
          title: { $first: { $concat: ['$examType', ' ', '$subjectName', ' Exam'] } },
          subject: { $first: '$subjectName' },
          class: { $first: '$className' },
          date: { $first: '$date' },
          examType: { $first: '$examType' },
          maxMarks: { $first: '$maxScore' },
          duration: { $first: { $literal: 90 } }, // Default duration
          instructions: { $first: { $literal: 'Answer all questions clearly.' } },
          createdBy: { $first: '$teacherId' },
          students: {
            $push: {
              _id: '$studentId',
              name: '$studentName',
              studentId: '$studentId',
              marks: '$score'
            }
          },
          averageScore: { $avg: '$score' },
          totalStudents: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'teachers',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'teacher'
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          subject: 1,
          class: 1,
          date: 1,
          examType: 1,
          maxMarks: 1,
          duration: 1,
          instructions: 1,
          createdBy: 1,
          createdByName: { $arrayElemAt: ['$teacher.name', 0] },
          students: 1,
          averageScore: { $round: ['$averageScore', 2] },
          totalStudents: 1
        }
      },
      { $sort: { date: -1 } }
    ]);

    res.json({
      success: true,
      data: exams
    });
  } catch (error) {
    console.error('Fetch exams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exams',
      error: error.message
    });
  }
});

// Create new exam (creates grade entries for all students in all classes)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, subject, date, duration, maxMarks, instructions, examType = 'exam', applyToAllClasses = true } = req.body;
    
    let students = [];
    let totalGradesCreated = 0;
    let classesAffected = [];

    if (applyToAllClasses) {
      // Find all active students across all classes
      students = await Student.find({ 
        status: 'active' 
      }).select('_id name studentId class section');

      if (students.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No active students found in the school'
        });
      }

      // Group students by class for grade entries
      const studentsByClass = students.reduce((acc, student) => {
        const classKey = `${student.class}-${student.section}`;
        if (!acc[classKey]) {
          acc[classKey] = [];
          classesAffected.push(classKey);
        }
        acc[classKey].push(student);
        return acc;
      }, {});

      // Create grade entries for all students in all classes
      const allGradeEntries = [];
      
      for (const [className, classStudents] of Object.entries(studentsByClass)) {
        const gradeEntries = classStudents.map(student => ({
          studentId: student._id,
          studentName: student.name,
          className: className,
          subjectName: subject,
          examType: examType,
          score: 0,
          maxScore: parseInt(maxMarks),
          teacherId: req.user._id,
          date: new Date(date),
          term: 'Current Term',
          academicYear: '2024-25',
          remarks: 'School-wide exam created - scores pending'
        }));
        allGradeEntries.push(...gradeEntries);
      }

      const createdGrades = await Grade.insertMany(allGradeEntries);
      totalGradesCreated = createdGrades.length;

    } else {
      // Legacy single class creation (if needed)
      const { class: className } = req.body;
      students = await Student.find({ 
        class: className, 
        status: 'active' 
      }).select('_id name studentId class section');

      if (students.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No active students found in the specified class'
        });
      }

      const gradeEntries = students.map(student => ({
        studentId: student._id,
        studentName: student.name,
        className: `${student.class}-${student.section}`,
        subjectName: subject,
        examType: examType,
        score: 0,
        maxScore: parseInt(maxMarks),
        teacherId: req.user._id,
        date: new Date(date),
        term: 'Current Term',
        academicYear: '2024-25',
        remarks: 'Exam created - scores pending'
      }));

      const createdGrades = await Grade.insertMany(gradeEntries);
      totalGradesCreated = createdGrades.length;
      classesAffected = [`${className}`];
    }
    
    const examData = {
      _id: `${subject}_${examType}_${Date.now()}`,
      title,
      subject,
      date: new Date(date),
      duration: parseInt(duration),
      maxMarks: parseInt(maxMarks),
      instructions,
      examType,
      createdBy: req.user._id,
      applyToAllClasses,
      classesAffected,
      totalStudents: students.length,
      gradesCreated: totalGradesCreated
    };
    
    res.status(201).json({
      success: true,
      data: examData,
      message: applyToAllClasses 
        ? `School-wide exam created successfully for ${classesAffected.length} classes with ${totalGradesCreated} student entries`
        : `Exam created successfully with ${totalGradesCreated} student entries`
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create exam',
      error: error.message
    });
  }
});

// Get students for an exam (based on subject, class, and exam type)
router.get('/:subject/:className/:examType/students', authMiddleware, async (req, res) => {
  try {
    const { subject, className, examType } = req.params;
    
    const students = await Grade.find({
      subjectName: subject,
      className: className,
      examType: examType
    })
    .populate('studentId', 'name studentId')
    .select('studentId score maxScore gradeLevel remarks')
    .sort({ studentName: 1 });
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found for this exam'
      });
    }
    
    const formattedStudents = students.map(grade => ({
      _id: grade.studentId._id,
      name: grade.studentId.name,
      studentId: grade.studentId.studentId,
      marks: grade.score,
      maxMarks: grade.maxScore,
      gradeLevel: grade.gradeLevel,
      remarks: grade.remarks
    }));
    
    res.json({
      success: true,
      data: formattedStudents
    });
  } catch (error) {
    console.error('Fetch exam students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// Save marks for an exam
router.post('/:subject/:className/:examType/marks', authMiddleware, async (req, res) => {
  try {
    const { subject, className, examType } = req.params;
    const { marks } = req.body;
    
    const updatePromises = [];
    let updatedCount = 0;
    
    for (const [studentId, mark] of Object.entries(marks)) {
      if (mark !== '' && !isNaN(mark)) {
        const updatePromise = Grade.findOneAndUpdate(
          {
            studentId: studentId,
            subjectName: subject,
            className: className,
            examType: examType
          },
          {
            score: parseInt(mark),
            remarks: 'Marks updated'
          },
          { new: true }
        );
        updatePromises.push(updatePromise);
        updatedCount++;
      }
    }
    
    const updatedGrades = await Promise.all(updatePromises);
    
    // Get updated exam data
    const examData = await Grade.aggregate([
      {
        $match: {
          subjectName: subject,
          className: className,
          examType: examType
        }
      },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$score' },
          totalStudents: { $sum: 1 },
          maxScore: { $first: '$maxScore' }
        }
      }
    ]);
    
    res.json({
      success: true,
      message: `Marks saved successfully for ${updatedCount} students`,
      data: {
        updatedCount,
        examStats: examData[0] || {},
        updatedGrades: updatedGrades.filter(grade => grade !== null)
      }
    });
  } catch (error) {
    console.error('Save marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save marks',
      error: error.message
    });
  }
});

// Generate report cards
router.post('/:subject/:className/:examType/report-cards', authMiddleware, async (req, res) => {
  try {
    const { subject, className, examType } = req.params;
    
    const examGrades = await Grade.find({
      subjectName: subject,
      className: className,
      examType: examType
    })
    .populate('studentId', 'name studentId')
    .select('studentId score maxScore gradeLevel date');
    
    if (examGrades.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No exam data found'
      });
    }
    
    // In a real application, you would generate PDF report cards here
    const reportData = {
      examInfo: {
        subject,
        className,
        examType,
        date: examGrades[0].date,
        totalStudents: examGrades.length
      },
      students: examGrades.map(grade => ({
        name: grade.studentId.name,
        studentId: grade.studentId.studentId,
        score: grade.score,
        maxScore: grade.maxScore,
        percentage: Math.round((grade.score / grade.maxScore) * 100),
        gradeLevel: grade.gradeLevel
      }))
    };
    
    res.json({
      success: true,
      message: `Report cards generated for ${examGrades.length} students`,
      data: reportData,
      downloadUrl: `/api/exams/${subject}/${className}/${examType}/report-cards/download`
    });
  } catch (error) {
    console.error('Generate report cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report cards',
      error: error.message
    });
  }
});

// Delete exam (removes all grade entries for the exam)
router.delete('/:subject/:className/:examType', authMiddleware, async (req, res) => {
  try {
    const { subject, className, examType } = req.params;
    
    const deleteResult = await Grade.deleteMany({
      subjectName: subject,
      className: className,
      examType: examType
    });
    
    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    res.json({
      success: true,
      message: `Exam deleted successfully. Removed ${deleteResult.deletedCount} grade entries.`
    });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete exam',
      error: error.message
    });
  }
});

export default router;