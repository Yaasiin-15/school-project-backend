import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  subjectId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['core', 'elective', 'optional', 'extracurricular'],
    default: 'core'
  },
  credits: {
    type: Number,
    min: 1,
    max: 10,
    default: 3
  },
  curriculum: {
    syllabus: String,
    objectives: [String],
    outcomes: [String],
    prerequisites: [String],
    textbooks: [{
      title: String,
      author: String,
      isbn: String,
      edition: String
    }],
    references: [{
      title: String,
      author: String,
      type: { type: String, enum: ['book', 'journal', 'website', 'other'] }
    }]
  },
  gradeLevel: [{
    type: String,
    required: true
  }],
  teachers: [{
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    classes: [String]
  }],
  schedule: {
    hoursPerWeek: {
      type: Number,
      min: 1,
      max: 20,
      default: 4
    },
    practicalHours: {
      type: Number,
      min: 0,
      default: 0
    },
    theoryHours: {
      type: Number,
      min: 0,
      default: 4
    }
  },
  assessment: {
    internalMarks: {
      type: Number,
      min: 0,
      max: 100,
      default: 40
    },
    externalMarks: {
      type: Number,
      min: 0,
      max: 100,
      default: 60
    },
    passingMarks: {
      type: Number,
      min: 0,
      max: 100,
      default: 40
    },
    gradingSystem: {
      type: String,
      enum: ['percentage', 'gpa', 'letter'],
      default: 'percentage'
    }
  },
  resources: {
    laboratory: {
      required: { type: Boolean, default: false },
      equipment: [String]
    },
    software: [String],
    onlineResources: [{
      name: String,
      url: String,
      type: String
    }]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-25'
  }
}, {
  timestamps: true
});

// Indexes for better performance
subjectSchema.index({ subjectId: 1 });
subjectSchema.index({ code: 1 });
subjectSchema.index({ name: 1 });
subjectSchema.index({ department: 1 });
subjectSchema.index({ gradeLevel: 1 });
subjectSchema.index({ status: 1 });
subjectSchema.index({ academicYear: 1 });

export default mongoose.model('Subject', subjectSchema);