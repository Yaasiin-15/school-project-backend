import express from 'express';
import { uploadProfileImage, deleteImage, getImagePath, getImageUrl } from '../middleware/upload.js';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';

const router = express.Router();

// @route   POST /api/upload/profile
// @desc    Upload profile image for current user
// @access  Private
router.post('/profile', authMiddleware, (req, res) => {
  uploadProfileImage(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    try {
      const user = req.user;
      const imageUrl = getImageUrl(req, req.file.filename);
      
      // Delete old profile image if exists
      if (user.profileImage) {
        const oldImageName = user.profileImage.split('/').pop();
        const oldImagePath = getImagePath(oldImageName);
        deleteImage(oldImagePath);
      }

      // Update user profile image
      await User.findByIdAndUpdate(user._id, {
        profileImage: imageUrl
      });

      // Update corresponding student/teacher record
      if (user.role === 'student') {
        await Student.findOneAndUpdate(
          { userId: user._id },
          { profileImage: imageUrl }
        );
      } else if (user.role === 'teacher') {
        await Teacher.findOneAndUpdate(
          { userId: user._id },
          { profileImage: imageUrl }
        );
      }

      res.json({
        success: true,
        message: 'Profile image uploaded successfully',
        data: {
          imageUrl,
          filename: req.file.filename
        }
      });
    } catch (error) {
      // Delete uploaded file if database update fails
      deleteImage(req.file.path);
      
      res.status(500).json({
        success: false,
        message: 'Failed to update profile image',
        error: error.message
      });
    }
  });
});

// @route   DELETE /api/upload/profile
// @desc    Delete profile image for current user
// @access  Private
router.delete('/profile', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!user.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'No profile image to delete'
      });
    }

    // Delete image file
    const imageName = user.profileImage.split('/').pop();
    const imagePath = getImagePath(imageName);
    deleteImage(imagePath);

    // Update user record
    await User.findByIdAndUpdate(user._id, {
      profileImage: null
    });

    // Update corresponding student/teacher record
    if (user.role === 'student') {
      await Student.findOneAndUpdate(
        { userId: user._id },
        { profileImage: null }
      );
    } else if (user.role === 'teacher') {
      await Teacher.findOneAndUpdate(
        { userId: user._id },
        { profileImage: null }
      );
    }

    res.json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile image',
      error: error.message
    });
  }
});

// @route   POST /api/upload/student/:id/profile
// @desc    Upload profile image for specific student (Admin only)
// @access  Private (Admin)
router.post('/student/:id/profile', authMiddleware, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }

  uploadProfileImage(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    try {
      const studentId = req.params.id;
      const student = await Student.findById(studentId);
      
      if (!student) {
        deleteImage(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      const imageUrl = getImageUrl(req, req.file.filename);
      
      // Delete old profile image if exists
      if (student.profileImage) {
        const oldImageName = student.profileImage.split('/').pop();
        const oldImagePath = getImagePath(oldImageName);
        deleteImage(oldImagePath);
      }

      // Update student profile image
      await Student.findByIdAndUpdate(studentId, {
        profileImage: imageUrl
      });

      // Update user record
      await User.findByIdAndUpdate(student.userId, {
        profileImage: imageUrl
      });

      res.json({
        success: true,
        message: 'Student profile image uploaded successfully',
        data: {
          imageUrl,
          filename: req.file.filename
        }
      });
    } catch (error) {
      deleteImage(req.file.path);
      
      res.status(500).json({
        success: false,
        message: 'Failed to update student profile image',
        error: error.message
      });
    }
  });
});

// @route   POST /api/upload/teacher/:id/profile
// @desc    Upload profile image for specific teacher (Admin only)
// @access  Private (Admin)
router.post('/teacher/:id/profile', authMiddleware, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }

  uploadProfileImage(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    try {
      const teacherId = req.params.id;
      const teacher = await Teacher.findById(teacherId);
      
      if (!teacher) {
        deleteImage(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Teacher not found'
        });
      }

      const imageUrl = getImageUrl(req, req.file.filename);
      
      // Delete old profile image if exists
      if (teacher.profileImage) {
        const oldImageName = teacher.profileImage.split('/').pop();
        const oldImagePath = getImagePath(oldImageName);
        deleteImage(oldImagePath);
      }

      // Update teacher profile image
      await Teacher.findByIdAndUpdate(teacherId, {
        profileImage: imageUrl
      });

      // Update user record
      await User.findByIdAndUpdate(teacher.userId, {
        profileImage: imageUrl
      });

      res.json({
        success: true,
        message: 'Teacher profile image uploaded successfully',
        data: {
          imageUrl,
          filename: req.file.filename
        }
      });
    } catch (error) {
      deleteImage(req.file.path);
      
      res.status(500).json({
        success: false,
        message: 'Failed to update teacher profile image',
        error: error.message
      });
    }
  });
});

export default router;