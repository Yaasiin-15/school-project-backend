import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  targetAudience: [{
    type: String,
    enum: ['admin', 'teacher', 'student', 'parent', 'accountant', 'all'],
    required: true
  }],
  category: {
    type: String,
    enum: ['general', 'academic', 'event', 'meeting', 'emergency', 'facility'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiryDate: {
    type: Date
  },
  views: {
    type: Number,
    default: 0
  },
  viewedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mimeType: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
announcementSchema.index({ targetAudience: 1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ category: 1 });
announcementSchema.index({ isActive: 1 });
announcementSchema.index({ createdAt: -1 });

// Check if announcement is expired
announcementSchema.methods.isExpired = function() {
  return this.expiryDate && new Date() > this.expiryDate;
};

// Add view to announcement
announcementSchema.methods.addView = function(userId) {
  const existingView = this.viewedBy.find(view => view.userId.toString() === userId.toString());
  
  if (!existingView) {
    this.viewedBy.push({ userId });
    this.views += 1;
  }
  
  return this.save();
};

export default mongoose.model('Announcement', announcementSchema);