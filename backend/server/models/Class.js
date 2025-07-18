import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true
  },
  grade: {
    type: String,
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  teacherName: {
    type: String
  },
  subjects: [{
    type: String,
    required: true
  }],
  room: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  studentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  schedule: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    periods: [{
      subject: String,
      startTime: String,
      endTime: String,
      teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher'
      }
    }]
  }],
  academicYear: {
    type: String,
    required: true,
    default: '2024-25'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for better performance
classSchema.index({ grade: 1, section: 1 });
classSchema.index({ teacherId: 1 });
classSchema.index({ academicYear: 1 });
classSchema.index({ status: 1 });

// Middleware to update student count
classSchema.pre('save', function(next) {
  this.studentCount = this.students.length;
  next();
});

export default mongoose.model('Class', classSchema);