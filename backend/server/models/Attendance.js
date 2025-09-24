import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: false
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: false
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: false
  },
  date: {
    type: Date,
    required: true
  },
  period: {
    type: Number,
    min: 1,
    max: 10
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused', 'sick', 'holiday'],
    required: true
  },
  timeIn: {
    type: Date
  },
  timeOut: {
    type: Date
  },
  reason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  parentNotified: {
    type: Boolean,
    default: false
  },
  notificationSentAt: {
    type: Date
  },
  attendanceType: {
    type: String,
    enum: ['daily', 'period', 'event', 'transport'],
    default: 'daily'
  },
  location: {
    type: String,
    enum: ['classroom', 'library', 'playground', 'auditorium', 'transport', 'other'],
    default: 'classroom'
  },
  deviceInfo: {
    deviceId: String,
    ipAddress: String,
    userAgent: String
  },
  geoLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modificationReason: {
    type: String,
    trim: true
  },
  academicYear: {
    type: String,
    default: '2024-25'
  }
}, {
  timestamps: true
});

// Compound indexes for better performance
AttendanceSchema.index({ student: 1, date: 1 });
AttendanceSchema.index({ class: 1, date: 1 });
AttendanceSchema.index({ teacher: 1, date: 1 });
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ academicYear: 1, date: 1 });
AttendanceSchema.index({ parentNotified: 1, status: 1 });

// Ensure unique attendance per student per day (for daily attendance)
AttendanceSchema.index(
  { student: 1, date: 1, attendanceType: 1, period: 1 },
  { 
    unique: true,
    partialFilterExpression: { attendanceType: { $in: ['daily', 'period'] } }
  }
);

// Virtual for attendance percentage calculation
AttendanceSchema.virtual('isPresent').get(function() {
  return ['present', 'late'].includes(this.status);
});

// Static method to calculate attendance percentage
AttendanceSchema.statics.calculateAttendancePercentage = async function(studentId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        student: mongoose.Types.ObjectId(studentId),
        date: { $gte: startDate, $lte: endDate },
        attendanceType: 'daily'
      }
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: 1 },
        presentDays: {
          $sum: {
            $cond: [
              { $in: ['$status', ['present', 'late']] },
              1,
              0
            ]
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  if (result.length === 0) return { percentage: 0, totalDays: 0, presentDays: 0 };
  
  const { totalDays, presentDays } = result[0];
  const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  
  return { percentage, totalDays, presentDays };
};

// Static method to get attendance summary by class
AttendanceSchema.statics.getClassAttendanceSummary = async function(classId, date) {
  const pipeline = [
    {
      $match: {
        class: mongoose.Types.ObjectId(classId),
        date: new Date(date),
        attendanceType: 'daily'
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    sick: 0,
    total: 0
  };

  result.forEach(item => {
    summary[item._id] = item.count;
    summary.total += item.count;
  });

  summary.percentage = summary.total > 0 
    ? Math.round(((summary.present + summary.late) / summary.total) * 100)
    : 0;

  return summary;
};

const Attendance = mongoose.model('Attendance', AttendanceSchema);
export default Attendance; 