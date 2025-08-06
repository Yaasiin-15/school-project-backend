import express from 'express';
import multer from 'multer';
import path from 'path';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/resources/');
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

// Mock data for demonstration
let resources = [
  {
    _id: '1',
    name: 'Mathematics Textbook Chapter 5.pdf',
    originalName: 'Mathematics Textbook Chapter 5.pdf',
    type: 'pdf',
    size: 2048576,
    uploadedBy: 'John Smith',
    uploadedById: 'teacher1',
    uploadDate: new Date(),
    downloads: 45,
    accessLevel: 'students',
    subject: 'Mathematics',
    grade: 'Grade 10',
    description: 'Chapter 5 covering algebraic equations and functions',
    filePath: '/uploads/resources/math-chapter5.pdf'
  },
  {
    _id: '2',
    name: 'Science Lab Video - Experiment 3.mp4',
    originalName: 'Science Lab Video - Experiment 3.mp4',
    type: 'video',
    size: 15728640,
    uploadedBy: 'Sarah Johnson',
    uploadedById: 'teacher2',
    uploadDate: new Date(Date.now() - 86400000),
    downloads: 23,
    accessLevel: 'teachers',
    subject: 'Science',
    grade: 'Grade 9',
    description: 'Laboratory experiment demonstrating chemical reactions',
    filePath: '/uploads/resources/science-lab-exp3.mp4'
  },
  {
    _id: '3',
    name: 'History Timeline Presentation.pptx',
    originalName: 'History Timeline Presentation.pptx',
    type: 'presentation',
    size: 5242880,
    uploadedBy: 'Mike Wilson',
    uploadedById: 'teacher3',
    uploadDate: new Date(Date.now() - 172800000),
    downloads: 67,
    accessLevel: 'public',
    subject: 'History',
    grade: 'Grade 8',
    description: 'Timeline of major historical events in the 20th century',
    filePath: '/uploads/resources/history-timeline.pptx'
  }
];

// Get all resources
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, accessLevel, subject, grade, search, page = 1, limit = 20 } = req.query;
    
    let filteredResources = [...resources];
    
    // Apply filters
    if (type && type !== 'all') {
      filteredResources = filteredResources.filter(r => r.type === type);
    }
    
    if (accessLevel && accessLevel !== 'all') {
      filteredResources = filteredResources.filter(r => r.accessLevel === accessLevel);
    }
    
    if (subject) {
      filteredResources = filteredResources.filter(r => 
        r.subject.toLowerCase().includes(subject.toLowerCase())
      );
    }
    
    if (grade) {
      filteredResources = filteredResources.filter(r => 
        r.grade.toLowerCase().includes(grade.toLowerCase())
      );
    }
    
    if (search) {
      filteredResources = filteredResources.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        r.uploadedBy.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Sort by upload date (newest first)
    filteredResources.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResources = filteredResources.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedResources,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredResources.length / limit),
        totalResources: filteredResources.length
      }
    });
  } catch (error) {
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
    
    // Get file type from mimetype
    const getFileType = (mimetype) => {
      if (mimetype.includes('pdf')) return 'pdf';
      if (mimetype.includes('word')) return 'document';
      if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'presentation';
      if (mimetype.includes('image')) return 'image';
      if (mimetype.includes('video')) return 'video';
      if (mimetype.includes('audio')) return 'audio';
      return 'other';
    };
    
    const newResource = {
      _id: Date.now().toString(),
      name: req.file.filename,
      originalName: req.file.originalname,
      type: getFileType(req.file.mimetype),
      size: req.file.size,
      uploadedBy: req.user.name || 'Unknown User',
      uploadedById: req.user.id,
      uploadDate: new Date(),
      downloads: 0,
      accessLevel: accessLevel || 'students',
      subject: subject || 'General',
      grade: grade || 'All Grades',
      description: description || '',
      filePath: `/uploads/resources/${req.file.filename}`
    };
    
    resources.push(newResource);
    
    res.status(201).json({
      success: true,
      data: newResource,
      message: 'Resource uploaded successfully'
    });
  } catch (error) {
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
    
    const resource = resources.find(r => r._id === resourceId);
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
    const resourceIndex = resources.findIndex(r => r._id === resourceId);
    if (resourceIndex !== -1) {
      resources[resourceIndex].downloads += 1;
    }
    
    // In a real application, you would serve the actual file
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Download initiated',
      downloadUrl: resource.filePath,
      fileName: resource.originalName
    });
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