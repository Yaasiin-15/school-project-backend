import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import User from '../models/User.js';

const router = express.Router();

// @route   GET /api/timetable/classes
// @desc    Get all classes for timetable
// @access  Private
router.get('/classes', authMiddleware, async (req, res) => {
  try {
    const classes = await Class.find({ status: 'active' })
      .populate('classTeacher', 'name')
      .select('name grade section subjects classTeacher');
    
    res.json({
      success: true,
      data: { classes }
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes'
    });
  }
});

// @route   GET /api/timetable/teachers
// @desc    Get all teachers for timetable
// @access  Private
router.get('/teachers', authMiddleware, async (req, res) => {
  try {
    const teachers = await Teacher.find({ status: 'active' })
      .populate('userId', 'name email')
      .select('teacherId subjects qualification');
    
    res.json({
      success: true,
      data: { teachers }
    });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers'
    });
  }
});

// @route   GET /api/timetable/:classId
// @desc    Get timetable for a specific class
// @access  Private
router.get('/:classId', authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    
    // For now, return a sample timetable structure
    // In a real implementation, you'd have a Timetable model
    const sampleTimetable = {
      Monday: {
        1: { subject: 'Mathematics', teacher: 'John Smith', room: 'Room 101' },
        2: { subject: 'English', teacher: 'Jane Doe', room: 'Room 102' },
        3: { subject: 'Science', teacher: 'Bob Johnson', room: 'Lab 1' },
        4: { subject: 'History', teacher: 'Alice Brown', room: 'Room 103' },
        5: { subject: 'Geography', teacher: 'Charlie Wilson', room: 'Room 104' },
        6: { subject: 'Art', teacher: 'Diana Davis', room: 'Art Room' },
        7: { subject: 'Physical Education', teacher: 'Eve Miller', room: 'Gym' },
        8: { subject: 'Music', teacher: 'Frank Garcia', room: 'Music Room' }
      },
      Tuesday: {
        1: { subject: 'Science', teacher: 'Bob Johnson', room: 'Lab 1' },
        2: { subject: 'Mathematics', teacher: 'John Smith', room: 'Room 101' },
        3: { subject: 'English', teacher: 'Jane Doe', room: 'Room 102' },
        4: { subject: 'Geography', teacher: 'Charlie Wilson', room: 'Room 104' },
        5: { subject: 'History', teacher: 'Alice Brown', room: 'Room 103' },
        6: { subject: 'Music', teacher: 'Frank Garcia', room: 'Music Room' },
        7: { subject: 'Art', teacher: 'Diana Davis', room: 'Art Room' },
        8: { subject: 'Physical Education', teacher: 'Eve Miller', room: 'Gym' }
      },
      Wednesday: {
        1: { subject: 'English', teacher: 'Jane Doe', room: 'Room 102' },
        2: { subject: 'Science', teacher: 'Bob Johnson', room: 'Lab 1' },
        3: { subject: 'Mathematics', teacher: 'John Smith', room: 'Room 101' },
        4: { subject: 'Art', teacher: 'Diana Davis', room: 'Art Room' },
        5: { subject: 'Music', teacher: 'Frank Garcia', room: 'Music Room' },
        6: { subject: 'Physical Education', teacher: 'Eve Miller', room: 'Gym' },
        7: { subject: 'History', teacher: 'Alice Brown', room: 'Room 103' },
        8: { subject: 'Geography', teacher: 'Charlie Wilson', room: 'Room 104' }
      },
      Thursday: {
        1: { subject: 'History', teacher: 'Alice Brown', room: 'Room 103' },
        2: { subject: 'Geography', teacher: 'Charlie Wilson', room: 'Room 104' },
        3: { subject: 'Physical Education', teacher: 'Eve Miller', room: 'Gym' },
        4: { subject: 'Mathematics', teacher: 'John Smith', room: 'Room 101' },
        5: { subject: 'English', teacher: 'Jane Doe', room: 'Room 102' },
        6: { subject: 'Science', teacher: 'Bob Johnson', room: 'Lab 1' },
        7: { subject: 'Music', teacher: 'Frank Garcia', room: 'Music Room' },
        8: { subject: 'Art', teacher: 'Diana Davis', room: 'Art Room' }
      },
      Friday: {
        1: { subject: 'Geography', teacher: 'Charlie Wilson', room: 'Room 104' },
        2: { subject: 'History', teacher: 'Alice Brown', room: 'Room 103' },
        3: { subject: 'Art', teacher: 'Diana Davis', room: 'Art Room' },
        4: { subject: 'Science', teacher: 'Bob Johnson', room: 'Lab 1' },
        5: { subject: 'Physical Education', teacher: 'Eve Miller', room: 'Gym' },
        6: { subject: 'Mathematics', teacher: 'John Smith', room: 'Room 101' },
        7: { subject: 'English', teacher: 'Jane Doe', room: 'Room 102' },
        8: { subject: 'Music', teacher: 'Frank Garcia', room: 'Music Room' }
      },
      Saturday: {
        1: { subject: 'Music', teacher: 'Frank Garcia', room: 'Music Room' },
        2: { subject: 'Art', teacher: 'Diana Davis', room: 'Art Room' },
        3: { subject: 'Physical Education', teacher: 'Eve Miller', room: 'Gym' },
        4: { subject: 'English', teacher: 'Jane Doe', room: 'Room 102' },
        5: { subject: 'Mathematics', teacher: 'John Smith', room: 'Room 101' },
        6: { subject: 'Science', teacher: 'Bob Johnson', room: 'Lab 1' }
      }
    };
    
    res.json({
      success: true,
      data: { timetable: sampleTimetable }
    });
  } catch (error) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable'
    });
  }
});

// @route   PUT /api/timetable/:classId
// @desc    Update a specific period in timetable
// @access  Private (Admin, Teacher)
router.put('/:classId', authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    const { day, period, subject, teacherId, room, notes } = req.body;
    
    // In a real implementation, you'd save to a Timetable model
    // For now, just return success
    res.json({
      success: true,
      message: 'Period updated successfully',
      data: { day, period, subject, teacherId, room, notes }
    });
  } catch (error) {
    console.error('Error updating period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update period'
    });
  }
});

// @route   DELETE /api/timetable/:classId/:day/:period
// @desc    Delete a specific period from timetable
// @access  Private (Admin, Teacher)
router.delete('/:classId/:day/:period', authMiddleware, async (req, res) => {
  try {
    const { classId, day, period } = req.params;
    
    // In a real implementation, you'd delete from a Timetable model
    // For now, just return success
    res.json({
      success: true,
      message: 'Period deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete period'
    });
  }
});

// @route   POST /api/timetable/:classId
// @desc    Create or update timetable for a class
// @access  Private (Admin, Teacher)
router.post('/:classId', authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    const { timetable } = req.body;
    
    // In a real implementation, you'd save to a Timetable model
    // For now, just return success
    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: { timetable }
    });
  } catch (error) {
    console.error('Error updating timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update timetable'
    });
  }
});

export default router;