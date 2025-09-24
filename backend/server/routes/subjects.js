import express from 'express';
import { body, validationResult } from 'express-validator';
import Subject from '../models/Subject.js';
import Teacher from '../models/Teacher.js';
import { generateId } from '../utils/helpers.js';

const router = express.Router();

// Validation middleware
const validateSubject = [
  body('name').trim().isLength({ min: 2 }).withMessage('Subject name must be at least 2 characters'),
  body('code').trim().isLength({ min: 2, max: 10 }).withMessage('Subject code must be 2-10 characters'),
  body('department').trim().isLength({ min: 2 }).withMessage('Department is required'),
  body('gradeLevel').isArray({ min: 1 }).withMessage('At least one grade level is required'),
  body('credits').isInt({ min: 1, max: 10 }).withMessage('Credits must be between 1 and 10')
];

// Get all subjects with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { code: { $regex: req.query.search, $options: 'i' } },
        { department: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    if (req.query.department) {
      filter.department = req.query.department;
    }
    
    if (req.query.gradeLevel) {
      filter.gradeLevel = { $in: [req.query.gradeLevel] };
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.academicYear) {
      filter.academicYear = req.query.academicYear;
    }

    const subjects = await Subject.find(filter)
      .populate('teachers.teacherId', 'name teacherId email')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Subject.countDocuments(filter);

    res.json({
      success: true,
      data: subjects,
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
      message: 'Error fetching subjects',
      error: error.message
    });
  }
});

// Get subject by ID
router.get('/:id', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate('teachers.teacherId', 'name teacherId email phone department');

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.json({
      success: true,
      data: subject
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching subject',
      error: error.message
    });
  }
});

// Create new subject
router.post('/', validateSubject, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if subject code already exists
    const existingSubject = await Subject.findOne({ 
      code: req.body.code.toUpperCase(),
      academicYear: req.body.academicYear || '2024-25'
    });

    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject with this code already exists for the academic year'
      });
    }

    const subjectData = {
      ...req.body,
      subjectId: generateId('SUB'),
      code: req.body.code.toUpperCase(),
      academicYear: req.body.academicYear || '2024-25'
    };

    const subject = new Subject(subjectData);
    await subject.save();

    await subject.populate('teachers.teacherId', 'name teacherId email');

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: subject
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating subject',
      error: error.message
    });
  }
});

// Update subject
router.put('/:id', validateSubject, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Check for duplicate code (excluding current subject)
    const existingSubject = await Subject.findOne({
      _id: { $ne: req.params.id },
      code: req.body.code.toUpperCase(),
      academicYear: req.body.academicYear || subject.academicYear
    });

    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject with this code already exists for the academic year'
      });
    }

    // Update subject
    Object.assign(subject, {
      ...req.body,
      code: req.body.code.toUpperCase()
    });
    
    await subject.save();
    await subject.populate('teachers.teacherId', 'name teacherId email');

    res.json({
      success: true,
      message: 'Subject updated successfully',
      data: subject
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating subject',
      error: error.message
    });
  }
});

// Delete subject
router.delete('/:id', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Check if subject is being used in grades or timetables
    const Grade = (await import('../models/Grade.js')).default;
    const gradesCount = await Grade.countDocuments({ subject: req.params.id });
    
    if (gradesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete subject as it has associated grades'
      });
    }

    // Soft delete by changing status
    subject.status = 'archived';
    await subject.save();

    res.json({
      success: true,
      message: 'Subject archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting subject',
      error: error.message
    });
  }
});

// Assign teacher to subject
router.post('/:id/assign-teacher', async (req, res) => {
  try {
    const { teacherId, isPrimary, classes } = req.body;

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID is required'
      });
    }

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Check if teacher is already assigned
    const existingAssignment = subject.teachers.find(t => 
      t.teacherId.toString() === teacherId
    );

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is already assigned to this subject'
      });
    }

    // If this is primary teacher, remove primary status from others
    if (isPrimary) {
      subject.teachers.forEach(t => t.isPrimary = false);
    }

    subject.teachers.push({
      teacherId,
      isPrimary: isPrimary || false,
      classes: classes || []
    });

    await subject.save();
    await subject.populate('teachers.teacherId', 'name teacherId email');

    res.json({
      success: true,
      message: 'Teacher assigned successfully',
      data: subject
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning teacher',
      error: error.message
    });
  }
});

// Remove teacher from subject
router.delete('/:id/remove-teacher/:teacherId', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    subject.teachers = subject.teachers.filter(t => 
      t.teacherId.toString() !== req.params.teacherId
    );

    await subject.save();

    res.json({
      success: true,
      message: 'Teacher removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing teacher',
      error: error.message
    });
  }
});

// Get subject curriculum
router.get('/:id/curriculum', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).select('curriculum');
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.json({
      success: true,
      data: subject.curriculum
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching curriculum',
      error: error.message
    });
  }
});

// Update subject curriculum
router.put('/:id/curriculum', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    subject.curriculum = { ...subject.curriculum, ...req.body };
    await subject.save();

    res.json({
      success: true,
      message: 'Curriculum updated successfully',
      data: subject.curriculum
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating curriculum',
      error: error.message
    });
  }
});

// Get subjects by department
router.get('/department/:department', async (req, res) => {
  try {
    const subjects = await Subject.find({ 
      department: req.params.department,
      status: 'active'
    })
    .populate('teachers.teacherId', 'name teacherId')
    .sort({ name: 1 });

    res.json({
      success: true,
      data: subjects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects by department',
      error: error.message
    });
  }
});

// Get subjects by grade level
router.get('/grade/:gradeLevel', async (req, res) => {
  try {
    const subjects = await Subject.find({ 
      gradeLevel: { $in: [req.params.gradeLevel] },
      status: 'active'
    })
    .populate('teachers.teacherId', 'name teacherId')
    .sort({ name: 1 });

    res.json({
      success: true,
      data: subjects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects by grade level',
      error: error.message
    });
  }
});

// Get subject-teacher mapping
router.get('/mapping/teacher-subjects', async (req, res) => {
  try {
    const subjects = await Subject.find({ status: 'active' })
      .populate('teachers.teacherId', 'name teacherId department')
      .select('name code department teachers gradeLevel');

    const mapping = subjects.reduce((acc, subject) => {
      subject.teachers.forEach(teacher => {
        if (!acc[teacher.teacherId._id]) {
          acc[teacher.teacherId._id] = {
            teacher: teacher.teacherId,
            subjects: []
          };
        }
        acc[teacher.teacherId._id].subjects.push({
          subject: {
            _id: subject._id,
            name: subject.name,
            code: subject.code,
            department: subject.department,
            gradeLevel: subject.gradeLevel
          },
          isPrimary: teacher.isPrimary,
          classes: teacher.classes
        });
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: Object.values(mapping)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching subject-teacher mapping',
      error: error.message
    });
  }
});

export default router;