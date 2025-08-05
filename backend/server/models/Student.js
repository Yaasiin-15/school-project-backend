import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentId: {
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
  class: {
    type: String,
    required: true
  },
  section: {
    type: String,
    default: 'A'
  },
  rollNumber: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date
  },
  phone: {
    type: String,
    trim: true
  },
  emergencyContact: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' }
  },
  parentInfo: {
    fatherName: String,
    motherName: String,
    guardianName: String,
    guardianPhone: String,
    guardianEmail: String
  },
  academicInfo: {
    admissionDate: { type: Date, default: Date.now },
    academicYear: { type: String, default: '2024-25' },
    previousSchool: String,
    subjects: [String]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'graduated', 'transferred'],
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
studentSchema.index({ studentId: 1 });
studentSchema.index({ class: 1, section: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ rollNumber: 1 });

export default mongoose.model('Student', studentSchema);