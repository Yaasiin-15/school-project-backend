import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import authMiddleware from '../middleware/auth.js';
import Resource from '../models/Resource.js';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = 'uploads/resources/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/avi',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, images, videos, and audio files are allowed.'));
    }
  }
});

// Helper function to get file type from mimetype
const getFileType = (mimetype) => {
  if (mimetype.includes('pdf')) return 'pdf';
  if (mimetype.includes('word')) return 'document';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'presentation';
  if (mimetype.includes('image')) return 'image';
  if (mimetype.includes('video')) return 'video';
  if (mimetype.includes('audio')) return 'audio';
  return 'other';
};

// Get all resources
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, accessLevel, subject, grade, search, page = 1, limit = 20 } = req.query;
    const userRole = req.user.role;
    
    // Build query based on user access level and filters
    let query = { isActive: true };
    
    // Apply access level filtering based on user role
    const allowedAccessLevels = [];
    switch (userRole) {
      case 'admin':
        allowedAccessLevels.push('public', 'students', 'teachers', 'admin');
        break;
      case 'teacher':
        allowedAccessLevels.push('public', 'students', 'teachers');
        break;
      case 'student':
        allowedAccessLevels.push('public', 'students');
        break;
      default:
        allowedAccessLevels.push('public');
    }
    query.accessLevel = { $in: allowedAccessLevels };
    
    // Apply additional filters
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (accessLevel && accessLevel !== 'all') {
      query.accessLevel = accessLevel;
    }
    
    if (subject) {
      query.subject = { $regex: subject, $options: 'i' };
    }
    
    if (grade) {
      query.grade = { $regex: grade, $options: 'i' };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { originalName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { uploadedByName: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Get resources with pagination
    const [resources, totalCount] = await Promise.all([
      Resource.find(query)
        .populate('uploadedBy', 'name profileImage')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit),
      Resource.countDocuments(query)
    ]);
    
    // Format resources for response
    const formattedResources = resources.map(resource => ({
      _id: resource._id,
      name: resource.name,
      originalName: resource.originalName,
      type: resource.type,
      size: resource.size,
      formattedSize: resource.formattedSize,
      uploadedBy: resource.uploadedByName,
      uploadedById: resource.uploadedBy._id,
      uploadDate: resource.createdAt,
      downloads: resource.downloads,
      accessLevel: resource.accessLevel,
      subject: resource.subject,
      grade: resource.grade,
      description: resource.description,
      tags: resource.tags,
      filePath: resource.filePath
    }));
    
    res.json({
      success: true,
      data: formattedResources,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalResources: totalCount
      }
    });
  } catch (error) {
    console.error('Fetch resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resources',
      error: error.message
    });
  }
});

// Upload new resource
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { subject, grade, accessLevel, description } = req.body;
    
    const newResource = new Resource({
      name: req.file.filename,
      originalName: req.file.originalname,
      type: getFileType(req.file.mimetype),
      size: req.file.size,
      formattedSize: formatFileSize(req.file.size),
      uploadedBy: req.user._id,
      uploadedByName: req.user.name || 'Unknown User',
      accessLevel: accessLevel || 'students',
      subject: subject || 'General',
      grade: grade || 'All Grades',
      description: description || '',
      filePath: `/uploads/resources/${req.file.filename}`,
      downloads: 0
    });
    
    await newResource.save();
    
    res.status(201).json({
      success: true,
      data: newResource,
      message: 'Resource uploaded successfully'
    });
  } catch (error) {
    // Delete uploaded file if database save fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload resource',
      error: error.message
    });
  }
});

// Download resource
router.get('/:resourceId/download', authMiddleware, async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check access permissions
    const userRole = req.user.role;
    if (resource.accessLevel === 'admin' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin access required.'
      });
    }
    
    if (resource.accessLevel === 'teachers' && !['admin', 'teacher'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Teacher access required.'
      });
    }
    
    // Increment download count
    resource.downloads += 1;
    await resource.save();
    
    // Serve the actual file
    const filePath = path.join(process.cwd(), 'uploads', 'resources', resource.name);
    if (fs.existsSync(filePath)) {
      res.download(filePath, resource.originalName);
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to download resource',
      error: error.message
    });
  }
});

// Get resource details
router.get('/:resourceId', authMiddleware, async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const resource = resources.find(r => r._id === resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    res.json({
      success: true,
      data: resource
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource details',
      error: error.message
    });
  }
});

// Update resource
router.put('/:resourceId', authMiddleware, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const updates = req.body;
    
    const resourceIndex = resources.findIndex(r => r._id === resourceId);
    if (resourceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check if user has permission to update (owner or admin)
    const resource = resources[resourceIndex];
    if (resource.uploadedById !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own resources.'
      });
    }
    
    // Update resource
    resources[resourceIndex] = {
      ...resources[resourceIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    res.json({
      success: true,
      data: resources[resourceIndex],
      message: 'Resource updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update resource',
      error: error.message
    });
  }
});

// Delete resource
router.delete('/:resourceId', authMiddleware, async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const resourceIndex = resources.findIndex(r => r._id === resourceId);
    if (resourceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check if user has permission to delete (owner or admin)
    const resource = resources[resourceIndex];
    if (resource.uploadedById !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own resources.'
      });
    }
    
    // In a real application, you would also delete the physical file
    // fs.unlinkSync(path.join(process.cwd(), resource.filePath));
    
    resources.splice(resourceIndex, 1);
    
    res.json({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete resource',
      error: error.message
    });
  }
});

// Get resources by user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const userResources = resources.filter(r => r.uploadedById === userId);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResources = userResources.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedResources,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(userResources.length / limit),
        totalResources: userResources.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user resources',
      error: error.message
    });
  }
});

// Get resource statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const stats = {
      totalResources: resources.length,
      totalDownloads: resources.reduce((sum, r) => sum + r.downloads, 0),
      resourcesByType: {
        pdf: resources.filter(r => r.type === 'pdf').length,
        video: resources.filter(r => r.type === 'video').length,
        image: resources.filter(r => r.type === 'image').length,
        document: resources.filter(r => r.type === 'document').length,
        presentation: resources.filter(r => r.type === 'presentation').length,
        audio: resources.filter(r => r.type === 'audio').length
      },
      resourcesByAccessLevel: {
        public: resources.filter(r => r.accessLevel === 'public').length,
        students: resources.filter(r => r.accessLevel === 'students').length,
        teachers: resources.filter(r => r.accessLevel === 'teachers').length,
        admin: resources.filter(r => r.accessLevel === 'admin').length
      },
      topDownloaded: resources
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, 5)
        .map(r => ({
          name: r.name,
          downloads: r.downloads,
          subject: r.subject
        }))
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource statistics',
      error: error.message
    });
  }
});

export default router;