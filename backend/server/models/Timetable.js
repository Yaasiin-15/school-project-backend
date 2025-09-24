import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema({
  timetableId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['class', 'teacher', 'room', 'master'],
    required: true
  },
  class: {
    type: String,
    required: function() { return this.type === 'class'; }
  },
  section: {
    type: String,
    required: function() { return this.type === 'class'; }
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: function() { return this.type === 'teacher'; }
  },
  room: {
    type: String,
    required: function() { return this.type === 'room'; }
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-25'
  },
  semester: {
    type: String,
    enum: ['1', '2', 'annual'],
    default: 'annual'
  },
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      required: true
    },
    periods: [{
      periodNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 10
      },
      startTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      endTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
      },
      teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher'
      },
      room: {
        type: String
      },
      type: {
        type: String,
        enum: ['theory', 'practical', 'tutorial', 'break', 'assembly', 'sports', 'library'],
        default: 'theory'
      },
      isBreak: {
        type: Boolean,
        default: false
      },
      notes: {
        type: String,
        trim: true
      }
    }]
  }],
  constraints: {
    maxPeriodsPerDay: {
      type: Number,
      min: 1,
      max: 10,
      default: 8
    },
    breakTimes: [{
      name: String,
      startTime: String,
      endTime: String,
      duration: Number
    }],
    lunchBreak: {
      startTime: String,
      endTime: String,
      duration: Number
    }
  },
  conflicts: [{
    type: {
      type: String,
      enum: ['teacher_clash', 'room_clash', 'subject_overload', 'time_constraint']
    },
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  optimization: {
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    metrics: {
      teacherUtilization: Number,
      roomUtilization: Number,
      subjectDistribution: Number,
      conflictCount: Number
    },
    lastOptimized: Date,
    optimizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'suspended'],
    default: 'draft'
  },
  effectiveFrom: {
    type: Date,
    required: true
  },
  effectiveTo: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true
});

// Indexes for better performance
timetableSchema.index({ timetableId: 1 });
timetableSchema.index({ type: 1 });
timetableSchema.index({ class: 1, section: 1 });
timetableSchema.index({ teacher: 1 });
timetableSchema.index({ academicYear: 1 });
timetableSchema.index({ status: 1 });
timetableSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

// Compound indexes for complex queries
timetableSchema.index({ 'schedule.day': 1, 'schedule.periods.startTime': 1 });
timetableSchema.index({ 'schedule.periods.teacher': 1, 'schedule.day': 1 });
timetableSchema.index({ 'schedule.periods.room': 1, 'schedule.day': 1 });

export default mongoose.model('Timetable', timetableSchema);