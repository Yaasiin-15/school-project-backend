import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['pdf', 'document', 'presentation', 'image', 'video', 'audio', 'other'],
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  filePath: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedByName: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  grade: {
    type: String,
    required: true,
    trim: true
  },
  accessLevel: {
    type: String,
    enum: ['public', 'students', 'teachers', 'admin'],
    default: 'students'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  downloads: {
    type: Number,
    default: 0,
    min: 0
  },
  downloadHistory: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    downloadedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiryDate: {
    type: Date
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  previousVersions: [{
    version: Number,
    filePath: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  metadata: {
    duration: Number, // For video/audio files
    dimensions: {
      width: Number,
      height: Number
    }, // For images/videos
    pageCount: Number, // For documents
    author: String,
    createdDate: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
resourceSchema.index({ uploadedBy: 1 });
resourceSchema.index({ subject: 1, grade: 1 });
resourceSchema.index({ type: 1 });
resourceSchema.index({ accessLevel: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ createdAt: -1 });
resourceSchema.index({ downloads: -1 });
resourceSchema.index({ isActive: 1 });

// Text search index
resourceSchema.index({
  name: 'text',
  description: 'text',
  subject: 'text',
  tags: 'text'
});

// Virtual for file size in human readable format
resourceSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Method to increment download count
resourceSchema.methods.incrementDownload = function(userId, userName, ipAddress) {
  this.downloads += 1;
  this.downloadHistory.push({
    userId,
    userName,
    ipAddress,
    downloadedAt: new Date()
  });
  return this.save();
};

// Method to check if user has access
resourceSchema.methods.hasAccess = function(userRole) {
  switch (this.accessLevel) {
    case 'public':
      return true;
    case 'students':
      return ['student', 'teacher', 'admin'].includes(userRole);
    case 'teachers':
      return ['teacher', 'admin'].includes(userRole);
    case 'admin':
      return userRole === 'admin';
    default:
      return false;
  }
};

// Static method to get resources by access level
resourceSchema.statics.getByAccessLevel = function(userRole, filters = {}) {
  const accessLevels = [];
  
  switch (userRole) {
    case 'admin':
      accessLevels.push('public', 'students', 'teachers', 'admin');
      break;
    case 'teacher':
      accessLevels.push('public', 'students', 'teachers');
      break;
    case 'student':
      accessLevels.push('public', 'students');
      break;
    default:
      accessLevels.push('public');
  }
  
  return this.find({
    ...filters,
    accessLevel: { $in: accessLevels },
    isActive: true
  });
};

export default mongoose.model('Resource', resourceSchema);