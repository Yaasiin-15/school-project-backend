import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  children: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    relationship: {
      type: String,
      enum: ['father', 'mother', 'guardian', 'other'],
      required: true
    }
  }],
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' }
  },
  occupation: {
    type: String,
    trim: true
  },
  workAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' }
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  preferences: {
    communicationMethod: {
      type: String,
      enum: ['email', 'sms', 'both'],
      default: 'both'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      attendance: { type: Boolean, default: true },
      grades: { type: Boolean, default: true },
      fees: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      events: { type: Boolean, default: true }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  profileImage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
parentSchema.index({ parentId: 1 });
parentSchema.index({ email: 1 });
parentSchema.index({ phone: 1 });
parentSchema.index({ 'children.studentId': 1 });
parentSchema.index({ status: 1 });

export default mongoose.model('Parent', parentSchema);