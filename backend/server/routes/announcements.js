import express from 'express';
import Announcement from '../models/Announcement.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/announcements
// @desc    Get all announcements with filtering
// @access  Private
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      audience,
      priority,
      category,
      isActive
    } = req.query;

    const query = {};
    
    // Filter by target audience
    if (audience && audience !== 'all') {
      query.targetAudience = { $in: [audience, 'all'] };
    } else {
      // Show announcements for user's role
      query.targetAudience = { $in: [req.user.role, 'all'] };
    }
    
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter out expired announcements for non-admin users
    if (req.user.role !== 'admin') {
      query.$or = [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: new Date() } }
      ];
    }

    const announcements = await Announcement.find(query)
      .populate('authorId', 'name email role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Announcement.countDocuments(query);

    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalAnnouncements: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: error.message
    });
  }
});

// @route   GET /api/announcements/:id
// @desc    Get announcement by ID and mark as viewed
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('authorId', 'name email role avatar');
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if user is in target audience
    if (!announcement.targetAudience.includes(req.user.role) && !announcement.targetAudience.includes('all')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Mark as viewed
    await announcement.addView(req.user._id);

    res.json({
      success: true,
      data: { announcement }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement',
      error: error.message
    });
  }
});

// @route   POST /api/announcements
// @desc    Create new announcement
// @access  Private (Admin only)
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      title,
      content,
      priority,
      targetAudience,
      category,
      expiryDate
    } = req.body;

    const announcement = new Announcement({
      title,
      content,
      author: req.user.name,
      authorId: req.user._id,
      priority,
      targetAudience,
      category,
      expiryDate: expiryDate ? new Date(expiryDate) : null
    });

    await announcement.save();

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: { announcement }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
      error: error.message
    });
  }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private (Admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: { announcement }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement',
      error: error.message
    });
  }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
      error: error.message
    });
  }
});

// @route   GET /api/announcements/my/feed
// @desc    Get user's announcement feed
// @access  Private
router.get('/my/feed', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const announcements = await Announcement.find({
      targetAudience: { $in: [req.user.role, 'all'] },
      isActive: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: new Date() } }
      ]
    })
    .populate('authorId', 'name role')
    .sort({ priority: -1, createdAt: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      data: { announcements }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement feed',
      error: error.message
    });
  }
});

// @route   GET /api/announcements/analytics/overview
// @desc    Get announcement analytics
// @access  Private (Admin only)
router.get('/analytics/overview', authorize('admin'), async (req, res) => {
  try {
    const totalAnnouncements = await Announcement.countDocuments();
    const activeAnnouncements = await Announcement.countDocuments({ isActive: true });
    const expiredAnnouncements = await Announcement.countDocuments({
      expiryDate: { $lt: new Date() }
    });

    // Priority distribution
    const priorityDistribution = await Announcement.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Category distribution
    const categoryDistribution = await Announcement.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Monthly announcements
    const monthlyAnnouncements = await Announcement.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        totalAnnouncements,
        activeAnnouncements,
        expiredAnnouncements,
        priorityDistribution,
        categoryDistribution,
        monthlyAnnouncements
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get announcement analytics',
      error: error.message
    });
  }
});

export default router;