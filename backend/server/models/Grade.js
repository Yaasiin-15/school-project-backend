import mongoose from 'mongoose';

const gradeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  classId: {
    type: String,
    required: false
  },
  className: {
    type: String,
    required: true
  },
  subjectName: {
    type: String,
    required: true
  },
  examType: {
    type: String,
    enum: ['quiz', 'assignment', 'midterm', 'final', 'project'],
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  maxScore: {
    type: Number,
    required: true,
    min: 1
  },
  gradeLevel: {
    type: String,
    required: false // Auto-calculated in pre-save hook
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  teacherName: {
    type: String
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  term: {
    type: String,
    enum: ['First Term', 'Second Term', 'Third Term'],
    required: true
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-25'
  },
  weightage: {
    type: Number,
    min: 1,
    max: 100,
    default: 10
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
gradeSchema.index({ studentId: 1, subjectName: 1, term: 1 });
gradeSchema.index({ teacherId: 1 });
gradeSchema.index({ date: -1 });

// Calculate grade level based on percentage
gradeSchema.pre('save', function (next) {
  const percentage = (this.score / this.maxScore) * 100;

  if (percentage >= 97) this.gradeLevel = 'A+';
  else if (percentage >= 93) this.gradeLevel = 'A';
  else if (percentage >= 90) this.gradeLevel = 'A-';
  else if (percentage >= 87) this.gradeLevel = 'B+';
  else if (percentage >= 83) this.gradeLevel = 'B';
  else if (percentage >= 80) this.gradeLevel = 'B-';
  else if (percentage >= 77) this.gradeLevel = 'C+';
  else if (percentage >= 73) this.gradeLevel = 'C';
  else if (percentage >= 70) this.gradeLevel = 'C-';
  else if (percentage >= 67) this.gradeLevel = 'D+';
  else if (percentage >= 65) this.gradeLevel = 'D';
  else this.gradeLevel = 'F';

  next();
});

export default mongoose.model('Grade', gradeSchema);