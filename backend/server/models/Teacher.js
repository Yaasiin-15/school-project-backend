import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacherId: {
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
    trim: true
  },
  subjects: [{
    type: String,
    required: true
  }],
  classes: [{
    type: String
  }],
  qualification: {
    type: String,
    required: true
  },
  experience: {
    type: Number,
    min: 0,
    default: 0
  },
  department: {
    type: String,
    required: true
  },
  dateOfJoining: {
    type: Date,
    default: Date.now
  },
  salary: {
    type: Number,
    min: 0
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' }
  },
  personalInfo: {
    dateOfBirth: Date,
    maritalStatus: String,
    emergencyContact: String,
    bloodGroup: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave', 'terminated'],
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
teacherSchema.index({ teacherId: 1 });
teacherSchema.index({ department: 1 });
teacherSchema.index({ subjects: 1 });
teacherSchema.index({ status: 1 });

export default mongoose.model('Teacher', teacherSchema);