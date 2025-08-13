import express from 'express';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/classes
// @desc    Get all classes with filtering
// @access  Private
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      grade,
      teacherId,
      academicYear,
      status = 'active'
    } = req.query;

    const query = {};
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (grade && grade !== 'all') {
      query.grade = grade;
    }
    
    if (teacherId && teacherId !== 'all') {
      query.teacherId = teacherId;
    }
    
    if (academicYear && academicYear !== 'all') {
      query.academicYear = academicYear;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { teacherName: { $regex: search, $options: 'i' } }
      ];
    }

    const classes = await Class.find(query)
      .populate('teacherId', 'name teacherId email')
      .populate('students', 'name studentId email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ grade: 1, section: 1 });

    const total = await Class.countDocuments(query);

    res.json({
      success: true,
      data: {
        classes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalClasses: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes',
      error: error.message
    });
  }
});

// @route   GET /api/classes/:id
// @desc    Get class by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('teacherId', 'name teacherId email phone')
      .populate('students', 'name studentId email avatar class section');
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      data: { class: classData }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch class',
      error: error.message
    });
  }
});

// @route   POST /api/classes
// @desc    Create new class
// @access  Private (Admin only)
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      section,
      grade,
      teacherId,
      subjects,
      room,
      capacity,
      academicYear
    } = req.body;

    // Get teacher information if provided
    let teacherName = '';
    if (teacherId) {
      const teacher = await Teacher.findById(teacherId);
      if (teacher) {
        teacherName = teacher.name;
      }
    }

    const classData = new Class({
      name,
      section,
      grade,
      teacherId,
      teacherName,
      subjects,
      room,
      capacity,
      academicYear
    });

    await classData.save();

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: { class: classData }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create class',
      error: error.message
    });
  }
});

// @route   PUT /api/classes/:id
// @desc    Update class
// @access  Private (Admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('teacherId', 'name email');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: { class: classData }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update class',
      error: error.message
    });
  }
});

// @route   DELETE /api/classes/:id
// @desc    Delete class
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete class',
      error: error.message
    });
  }
});

// @route   POST /api/classes/:id/students
// @desc    Add student to class
// @access  Private (Admin only)
router.post('/:id/students', authorize('admin'), async (req, res) => {
  try {
    const { studentId } = req.body;
    
    const classData = await Class.findById(req.params.id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student is already in class
    if (classData.students.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Student is already in this class'
      });
    }

    // Check class capacity
    if (classData.students.length >= classData.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Class is at full capacity'
      });
    }

    classData.students.push(studentId);
    await classData.save();

    // Update student's class
    student.class = classData.name;
    student.section = classData.section;
    await student.save();

    res.json({
      success: true,
      message: 'Student added to class successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add student to class',
      error: error.message
    });
  }
});

// @route   DELETE /api/classes/:id/students/:studentId
// @desc    Remove student from class
// @access  Private (Admin only)
router.delete('/:id/students/:studentId', authorize('admin'), async (req, res) => {
  try {
    const { id: classId, studentId } = req.params;
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    classData.students = classData.students.filter(
      sid => sid.toString() !== studentId
    );
    await classData.save();

    res.json({
      success: true,
      message: 'Student removed from class successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove student from class',
      error: error.message
    });
  }
});

// @route   GET /api/classes/teacher/me
// @desc    Get all classes assigned to the current teacher
// @access  Private (Teacher)
router.get('/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.user._id })
      .populate('students', 'name studentId email');
    res.json({ success: true, data: { classes } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch teacher classes', error: error.message });
  }
});

// @route   GET /api/classes/schedule/teacher/me
// @desc    Get schedule for the current teacher (today or weekly)
// @access  Private (Teacher)
router.get('/schedule/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    const weekly = req.query.weekly === 'true';
    const teacher = await Teacher.findOne({ userId: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const classes = await Class.find({ teacherId: teacher._id });
    
    if (weekly) {
      // Generate weekly schedule based on teacher's classes and subjects
      const weeklySchedule = [];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      
      days.forEach((day, dayIndex) => {
        classes.forEach((cls, classIndex) => {
          // Check if teacher has subjects and class has subjects
          const teacherSubjects = teacher.subjects || [];
          const classSubjects = cls.subjects || [];
          
          teacherSubjects.forEach((subject, subjectIndex) => {
            if (classSubjects.includes(subject)) {
              const hour = 9 + (subjectIndex * 2) + (classIndex % 2);
              weeklySchedule.push({
                day,
                time: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
                className: cls.name,
                subject,
                room: cls.room || `Room ${101 + subjectIndex}`
              });
            }
          });
        });
      });
      
      res.json({ success: true, data: { weeklySchedule } });
    } else {
      // Return today's schedule
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const schedule = [];
      
      classes.forEach((cls, classIndex) => {
        // Check if teacher has subjects and class has subjects
        const teacherSubjects = teacher.subjects || [];
        const classSubjects = cls.subjects || [];
        
        teacherSubjects.forEach((subject, subjectIndex) => {
          if (classSubjects.includes(subject)) {
            const hour = 9 + (subjectIndex * 2);
            schedule.push({
              id: cls._id,
              subject,
              class: cls.name,
              room: cls.room || `Room ${101 + subjectIndex}`,
              time: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
              status: 'upcoming'
            });
          }
        });
      });
      
      res.json({ success: true, data: { schedule } });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch teacher schedule', error: error.message });
  }
});

// @route   GET /api/classes/schedule
// @desc    Get general schedule (accessible to all authenticated users)
// @access  Private
router.get('/schedule', authorize('admin', 'teacher', 'student'), async (req, res) => {
  try {
    const weekly = req.query.weekly === 'true';
    
    if (weekly) {
      // Return a comprehensive weekly schedule for all classes
      const classes = await Class.find({ status: 'active' }).lean();
      const weeklySchedule = [];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      
      if (classes.length === 0) {
        // Return empty schedule if no classes found
        return res.json({ 
          success: true, 
          data: { 
            weeklySchedule: [],
            message: 'No active classes found'
          } 
        });
      }
      
      days.forEach((day, dayIndex) => {
        classes.forEach((cls, classIndex) => {
          // Use the new schedule structure if available
          if (cls.schedule && cls.schedule.length > 0) {
            const daySchedule = cls.schedule.find(s => s.day === day);
            if (daySchedule && daySchedule.periods) {
              daySchedule.periods.forEach((period, periodIndex) => {
                weeklySchedule.push({
                  _id: `${cls._id}_${day}_${period.subject}_${periodIndex}`,
                  day,
                  time: `${period.startTime} - ${period.endTime}`,
                  className: `${cls.name} - ${cls.section}`,
                  subject: period.subject,
                  teacher: cls.teacherName || 'TBA',
                  room: period.room || cls.room || `Room ${101 + (classIndex % 10)}`,
                  details: `${cls.name} ${cls.section} - ${period.subject}`,
                  grade: cls.grade
                });
              });
            }
          } else if (cls.subjects && cls.subjects.length > 0) {
            // Fallback to old structure
            cls.subjects.forEach((subject, subjectIndex) => {
              const hour = 9 + (subjectIndex % 6); // Limit to 6 periods per day
              weeklySchedule.push({
                _id: `${cls._id}_${day}_${subject}_${subjectIndex}`,
                day,
                time: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
                className: `${cls.name} - ${cls.section}`,
                subject,
                teacher: cls.teacherName || 'TBA',
                room: cls.room || `Room ${101 + (classIndex % 10)}`,
                details: `${cls.name} ${cls.section} - ${subject}`,
                grade: cls.grade
              });
            });
          }
        });
      });
      
      res.json({ 
        success: true, 
        data: { 
          weeklySchedule: weeklySchedule.slice(0, 50), // Limit to 50 entries to avoid overwhelming
          totalClasses: classes.length
        } 
      });
    } else {
      // Return today's schedule
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const classes = await Class.find({ status: 'active' }).lean();
      const todaySchedule = [];
      
      classes.forEach((cls, classIndex) => {
        // Use the new schedule structure if available
        if (cls.schedule && cls.schedule.length > 0) {
          const daySchedule = cls.schedule.find(s => s.day === today);
          if (daySchedule && daySchedule.periods) {
            daySchedule.periods.forEach((period, periodIndex) => {
              todaySchedule.push({
                _id: `${cls._id}_${today}_${period.subject}`,
                subject: period.subject,
                className: `${cls.name} - ${cls.section}`,
                teacher: cls.teacherName || 'TBA',
                room: period.room || cls.room || `Room ${101 + (classIndex % 10)}`,
                time: `${period.startTime} - ${period.endTime}`,
                status: 'scheduled'
              });
            });
          }
        } else if (cls.subjects && cls.subjects.length > 0) {
          // Fallback to old structure
          cls.subjects.forEach((subject, subjectIndex) => {
            const hour = 9 + (subjectIndex % 6);
            todaySchedule.push({
              _id: `${cls._id}_${today}_${subject}`,
              subject,
              className: `${cls.name} - ${cls.section}`,
              teacher: cls.teacherName || 'TBA',
              room: cls.room || `Room ${101 + (classIndex % 10)}`,
              time: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
              status: 'scheduled'
            });
          });
        }
      });
      
      res.json({ 
        success: true, 
        data: { 
          schedule: todaySchedule.slice(0, 20) // Limit today's schedule
        } 
      });
    }
  } catch (error) {
    console.error('Schedule fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch schedule', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/classes/schedule
// @desc    Add timetable entry (for admin)
// @access  Private (Admin)
router.post('/schedule', authorize('admin'), async (req, res) => {
  try {
    // For now, just return success - in a real implementation, 
    // you'd store this in a separate Schedule model
    res.json({ success: true, message: 'Timetable entry added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add timetable entry', error: error.message });
  }
});

// @route   GET /api/classes/:id/timetable
// @desc    Get class timetable
// @access  Private
router.get('/:id/timetable', authorize('admin', 'teacher', 'student'), async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id);
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Convert schedule array to timetable object for easier frontend handling
    const timetable = {};
    
    if (classData.schedule && classData.schedule.length > 0) {
      classData.schedule.forEach(daySchedule => {
        timetable[daySchedule.day] = {};
        daySchedule.periods.forEach(period => {
          timetable[daySchedule.day][period.period || period.startTime] = {
            subject: period.subject,
            teacherId: period.teacherId,
            room: period.room,
            startTime: period.startTime,
            endTime: period.endTime,
            notes: period.notes
          };
        });
      });
    }

    res.json({
      success: true,
      data: { timetable }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable',
      error: error.message
    });
  }
});

// @route   PUT /api/classes/:id/timetable
// @desc    Update class timetable period
// @access  Private (Admin, Teacher)
router.put('/:id/timetable', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { day, period, subject, teacherId, room, startTime, endTime, notes } = req.body;
    
    const classData = await Class.findById(req.params.id);
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Initialize schedule if it doesn't exist
    if (!classData.schedule) {
      classData.schedule = [];
    }

    // Find or create day schedule
    let daySchedule = classData.schedule.find(s => s.day === day);
    if (!daySchedule) {
      daySchedule = { day, periods: [] };
      classData.schedule.push(daySchedule);
    }

    // Find or create period
    let periodIndex = daySchedule.periods.findIndex(p => 
      p.period === period || p.startTime === startTime
    );
    
    const periodData = {
      subject,
      teacherId,
      room,
      startTime,
      endTime,
      period,
      notes
    };

    if (periodIndex >= 0) {
      // Update existing period
      daySchedule.periods[periodIndex] = periodData;
    } else {
      // Add new period
      daySchedule.periods.push(periodData);
    }

    await classData.save();

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: { period: periodData }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update timetable',
      error: error.message
    });
  }
});

// @route   DELETE /api/classes/:id/timetable/:day/:period
// @desc    Delete timetable period
// @access  Private (Admin, Teacher)
router.delete('/:id/timetable/:day/:period', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { id, day, period } = req.params;
    
    const classData = await Class.findById(id);
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Find day schedule
    const daySchedule = classData.schedule?.find(s => s.day === day);
    if (!daySchedule) {
      return res.status(404).json({
        success: false,
        message: 'Day schedule not found'
      });
    }

    // Remove period
    daySchedule.periods = daySchedule.periods.filter(p => 
      p.period !== period && p.period !== parseInt(period)
    );

    await classData.save();

    res.json({
      success: true,
      message: 'Period deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete period',
      error: error.message
    });
  }
});

// @route   GET /api/classes/timetable/conflicts
// @desc    Check for timetable conflicts
// @access  Private (Admin, Teacher)
router.get('/timetable/conflicts', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { teacherId, day, startTime, endTime, excludeClassId } = req.query;
    
    const query = {
      'schedule.day': day,
      'schedule.periods.teacherId': teacherId,
      'schedule.periods.startTime': { $lt: endTime },
      'schedule.periods.endTime': { $gt: startTime }
    };
    
    if (excludeClassId) {
      query._id = { $ne: excludeClassId };
    }

    const conflicts = await Class.find(query)
      .populate('schedule.periods.teacherId', 'name')
      .select('name section grade schedule');

    res.json({
      success: true,
      data: { conflicts }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check conflicts',
      error: error.message
    });
  }
});

// @route   POST /api/classes/seed-sample
// @desc    Create sample classes for testing (development only)
// @access  Private (Admin)
router.post('/seed-sample', authorize('admin'), async (req, res) => {
  try {
    // Check if classes already exist
    const existingClasses = await Class.countDocuments();
    if (existingClasses > 0) {
      return res.json({ 
        success: true, 
        message: `${existingClasses} classes already exist. No sample data created.` 
      });
    }

    const sampleClasses = [
      {
        name: 'Mathematics',
        section: 'A',
        grade: '10',
        subjects: ['Algebra', 'Geometry', 'Statistics'],
        room: 'Room 101',
        capacity: 30,
        academicYear: '2024-25',
        status: 'active'
      },
      {
        name: 'Science',
        section: 'B',
        grade: '10',
        subjects: ['Physics', 'Chemistry', 'Biology'],
        room: 'Room 102',
        capacity: 25,
        academicYear: '2024-25',
        status: 'active'
      },
      {
        name: 'English',
        section: 'A',
        grade: '9',
        subjects: ['Literature', 'Grammar', 'Writing'],
        room: 'Room 103',
        capacity: 28,
        academicYear: '2024-25',
        status: 'active'
      },
      {
        name: 'History',
        section: 'C',
        grade: '11',
        subjects: ['World History', 'Geography', 'Civics'],
        room: 'Room 104',
        capacity: 32,
        academicYear: '2024-25',
        status: 'active'
      }
    ];

    const createdClasses = await Class.insertMany(sampleClasses);
    
    res.json({ 
      success: true, 
      message: `${createdClasses.length} sample classes created successfully`,
      data: { classes: createdClasses }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create sample classes', 
      error: error.message 
    });
  }
});

// @route   PUT /api/classes/schedule/:id
// @desc    Update timetable entry (for admin)
// @access  Private (Admin)
router.put('/schedule/:id', authorize('admin'), async (req, res) => {
  try {
    // For now, just return success - in a real implementation, 
    // you'd update this in a separate Schedule model
    res.json({ success: true, message: 'Timetable entry updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update timetable entry', error: error.message });
  }
});

// @route   DELETE /api/classes/schedule/:id
// @desc    Delete timetable entry (for admin)
// @access  Private (Admin)
router.delete('/schedule/:id', authorize('admin'), async (req, res) => {
  try {
    // For now, just return success - in a real implementation, 
    // you'd delete this from a separate Schedule model
    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete timetable entry', error: error.message });
  }
});

export default router;