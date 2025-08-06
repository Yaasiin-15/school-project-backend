import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  className: {
    type: String,
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  teacherName: {
    type: String,
    required: true
  },
  examType: {
    type: String,
    enum: ['quiz', 'assignment', 'midterm', 'final', 'project', 'practical'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1 // Duration in minutes
  },
  maxMarks: {
    type: Number,
    required: true,
    min: 1
  },
  passingMarks: {
    type: Number,
    required: true,
    min: 0
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  syllabus: [{
    topic: String,
    weightage: Number // Percentage
  }],
  room: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
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
  students: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    studentName: String,
    studentRollNumber: String,
    isPresent: {
      type: Boolean,
      default: false
    },
    marksObtained: {
      type: Number,
      min: 0,
      default: 0
    },
    gradeLevel: String,
    remarks: String,
    submittedAt: Date,
    isEvaluated: {
      type: Boolean,
      default: false
    }
  }],
  questions: [{
    questionNumber: Number,
    question: String,
    questionType: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'true_false', 'fill_blank']
    },
    options: [String], // For MCQ
    correctAnswer: String,
    marks: Number,
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard']
    }
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  resultPublished: {
    type: Boolean,
    default: false
  },
  resultPublishedAt: Date,
  statistics: {
    totalStudents: {
      type: Number,
      default: 0
    },
    studentsAppeared: {
      type: Number,
      default: 0
    },
    studentsAbsent: {
      type: Number,
      default: 0
    },
    averageMarks: {
      type: Number,
      default: 0
    },
    highestMarks: {
      type: Number,
      default: 0
    },
    lowestMarks: {
      type: Number,
      default: 0
    },
    passPercentage: {
      type: Number,
      default: 0
    }
  },
  attachments: [{
    fileName: String,
    filePath: String,
    fileSize: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isOnline: {
    type: Boolean,
    default: false
  },
  onlineSettings: {
    platform: String,
    meetingLink: String,
    password: String,
    recordingEnabled: Boolean,
    proctoring: Boolean
  }
}, {
  timestamps: true
});

// Indexes for better performance
examSchema.index({ classId: 1, subject: 1 });
examSchema.index({ teacherId: 1 });
examSchema.index({ date: 1 });
examSchema.index({ status: 1 });
examSchema.index({ term: 1, academicYear: 1 });
examSchema.index({ examType: 1 });

// Virtual for exam duration in hours and minutes
examSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// Method to add student to exam
examSchema.methods.addStudent = function(studentData) {
  const existingStudent = this.students.find(
    s => s.studentId.toString() === studentData.studentId.toString()
  );
  
  if (!existingStudent) {
    this.students.push(studentData);
    this.statistics.totalStudents = this.students.length;
  }
  
  return this.save();
};

// Method to mark student attendance
examSchema.methods.markAttendance = function(studentId, isPresent) {
  const student = this.students.find(
    s => s.studentId.toString() === studentId.toString()
  );
  
  if (student) {
    student.isPresent = isPresent;
    this.updateStatistics();
  }
  
  return this.save();
};

// Method to update student marks
examSchema.methods.updateMarks = function(studentId, marks, remarks = '') {
  const student = this.students.find(
    s => s.studentId.toString() === studentId.toString()
  );
  
  if (student) {
    student.marksObtained = marks;
    student.remarks = remarks;
    student.isEvaluated = true;
    
    // Calculate grade level
    const percentage = (marks / this.maxMarks) * 100;
    if (percentage >= 97) student.gradeLevel = 'A+';
    else if (percentage >= 93) student.gradeLevel = 'A';
    else if (percentage >= 90) student.gradeLevel = 'A-';
    else if (percentage >= 87) student.gradeLevel = 'B+';
    else if (percentage >= 83) student.gradeLevel = 'B';
    else if (percentage >= 80) student.gradeLevel = 'B-';
    else if (percentage >= 77) student.gradeLevel = 'C+';
    else if (percentage >= 73) student.gradeLevel = 'C';
    else if (percentage >= 70) student.gradeLevel = 'C-';
    else if (percentage >= 67) student.gradeLevel = 'D+';
    else if (percentage >= 65) student.gradeLevel = 'D';
    else student.gradeLevel = 'F';
    
    this.updateStatistics();
  }
  
  return this.save();
};

// Method to update exam statistics
examSchema.methods.updateStatistics = function() {
  const presentStudents = this.students.filter(s => s.isPresent);
  const evaluatedStudents = this.students.filter(s => s.isEvaluated && s.isPresent);
  
  this.statistics.studentsAppeared = presentStudents.length;
  this.statistics.studentsAbsent = this.students.length - presentStudents.length;
  
  if (evaluatedStudents.length > 0) {
    const marks = evaluatedStudents.map(s => s.marksObtained);
    this.statistics.averageMarks = marks.reduce((sum, mark) => sum + mark, 0) / marks.length;
    this.statistics.highestMarks = Math.max(...marks);
    this.statistics.lowestMarks = Math.min(...marks);
    
    const passedStudents = evaluatedStudents.filter(s => s.marksObtained >= this.passingMarks);
    this.statistics.passPercentage = (passedStudents.length / evaluatedStudents.length) * 100;
  }
};

// Method to publish exam
examSchema.methods.publish = function() {
  this.isPublished = true;
  this.publishedAt = new Date();
  return this.save();
};

// Method to publish results
examSchema.methods.publishResults = function() {
  this.resultPublished = true;
  this.resultPublishedAt = new Date();
  return this.save();
};

// Static method to get upcoming exams
examSchema.statics.getUpcoming = function(classId, days = 7) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + days);
  
  return this.find({
    classId,
    date: { $gte: startDate, $lte: endDate },
    status: 'scheduled'
  }).sort({ date: 1 });
};

export default mongoose.model('Exam', examSchema);