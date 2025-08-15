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
  type: {
    type: String,
    required: true,
    enum: ['pdf', 'document', 'presentation', 'image', 'video', 'audio', 'other']
  },
  size: {
    type: Number,
    required: true
  },
  formattedSize: {
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
  accessLevel: {
    type: String,
    enum: ['public', 'students', 'teachers', 'admin'],
    default: 'students'
  },
  subject: {
    type: String,
    default: 'General'
  },
  grade: {
    type: String,
    default: 'All Grades'
  },
  description: {
    type: String,
    default: ''
  },
  filePath: {
    type: String,
    required: true
  },
  downloads: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
resourceSchema.index({ type: 1 });
resourceSchema.index({ accessLevel: 1 });
resourceSchema.index({ subject: 1 });
resourceSchema.index({ grade: 1 });
resourceSchema.index({ uploadedBy: 1 });
resourceSchema.index({ isActive: 1 });
resourceSchema.index({ createdAt: -1 });

// Text search index
resourceSchema.index({
  name: 'text',
  originalName: 'text',
  description: 'text',
  subject: 'text',
  tags: 'text'
});

export default mongoose.model('Resource', resourceSchema);