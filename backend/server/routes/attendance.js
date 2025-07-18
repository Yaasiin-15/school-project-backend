import express from 'express';
import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import Class from '../models/Class.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/attendance
// @desc    Create new attendance record
// @access  Private (Admin, Teacher)
router.post('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { studentId, classId, date, status, reason } = req.body;
    const attendance = new Attendance({
      studentId,
      classId,
      date,
      status,
      reason,
      createdBy: req.user._id
    });
    await attendance.save();
    res.status(201).json({ success: true, message: 'Attendance recorded', data: { attendance } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record attendance', error: error.message });
  }
});

// @route   GET /api/attendance/student/:studentId
// @desc    Get attendance records for a student
// @access  Private
router.get('/student/:studentId', authorize('admin', 'teacher', 'student'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await Attendance.find({ studentId }).sort({ date: -1 });
    res.json({ success: true, data: { records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
  }
});

// @route   GET /api/attendance/class/:classId
// @desc    Get attendance records for a class
// @access  Private
router.get('/class/:classId', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const records = await Attendance.find({ classId }).sort({ date: -1 });
    res.json({ success: true, data: { records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
  }
});

// @route   GET /api/attendance/teacher/me
// @desc    Get all attendance records for classes taught by the current teacher
// @access  Private (Teacher)
router.get('/teacher/me', authorize('teacher'), async (req, res) => {
  try {
    // Find all classes taught by this teacher
    const Class = (await import('../models/Class.js')).default;
    const classes = await Class.find({ teacherId: req.user._id });
    const classIds = classes.map(cls => cls._id);
    // Find all attendance records for those classes
    const records = await Attendance.find({ classId: { $in: classIds } }).sort({ date: -1 });
    res.json({ success: true, data: { attendance: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance for teacher', error: error.message });
  }
});

// @route   GET /api/attendance/me
// @desc    Get all attendance records for the current student
// @access  Private (Student)
router.get('/me', authorize('student'), async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.user._id }).sort({ date: -1 });
    res.json({ success: true, data: { attendance: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance for student', error: error.message });
  }
});

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (Admin, Teacher)
router.put('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.json({ success: true, message: 'Attendance updated', data: { attendance } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update attendance', error: error.message });
  }
});

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (Admin, Teacher)
router.delete('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.json({ success: true, message: 'Attendance deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete attendance', error: error.message });
  }
});

export default router; 