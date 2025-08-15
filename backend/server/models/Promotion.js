import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  currentClass: {
    type: String,
    required: true
  },
  currentGrade: {
    type: String,
    required: true
  },
  nextClass: {
    type: String,
    required: true
  },
  nextGrade: {
    type: String,
    required: true
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-25'
  },
  term: {
    type: String,
    enum: ['First Term', 'Second Term', 'Third Term'],
    required: true
  },
  examResults: {
    midterm: {
      completed: { type: Boolean, default: false },
      averageScore: { type: Number, default: 0 },
      totalSubjects: { type: Number, default: 0 },
      passedSubjects: { type: Number, default: 0 },
      completedDate: Date
    },
    final: {
      completed: { type: Boolean, default: false },
      averageScore: { type: Number, default: 0 },
      totalSubjects: { type: Number, default: 0 },
      passedSubjects: { type: Number, default: 0 },
      completedDate: Date
    }
  },
  overallAverage: {
    type: Number,
    default: 0
  },
  promotionStatus: {
    type: String,
    enum: ['pending', 'eligible', 'promoted', 'held_back', 'under_review'],
    default: 'pending'
  },
  promotionDate: Date,
  requirements: {
    minimumAttendance: { type: Number, default: 75 }, // percentage
    minimumGrade: { type: Number, default: 65 }, // percentage
    requiredExams: [{ type: String, enum: ['midterm', 'final'] }]
  },
  attendancePercentage: {
    type: Number,
    default: 0
  },
  feeStatus: {
    type: String,
    enum: ['paid', 'partial', 'pending'],
    default: 'pending'
  },
  remarks: {
    type: String,
    trim: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedByName: String,
  approvalDate: Date
}, {
  timestamps: true
});

// Indexes for better performance
promotionSchema.index({ studentId: 1, academicYear: 1 });
promotionSchema.index({ promotionStatus: 1 });
promotionSchema.index({ currentGrade: 1 });
promotionSchema.index({ term: 1, academicYear: 1 });

// Method to check if student meets promotion requirements
promotionSchema.methods.checkPromotionEligibility = function() {
  const { midterm, final } = this.examResults;
  const { minimumAttendance, minimumGrade, requiredExams } = this.requirements;
  
  // Check if required exams are completed
  const midtermRequired = requiredExams.includes('midterm');
  const finalRequired = requiredExams.includes('final');
  
  const midtermMet = !midtermRequired || (midterm.completed && midterm.averageScore >= minimumGrade);
  const finalMet = !finalRequired || (final.completed && final.averageScore >= minimumGrade);
  
  // Check attendance
  const attendanceMet = this.attendancePercentage >= minimumAttendance;
  
  // Check overall average
  const gradeMet = this.overallAverage >= minimumGrade;
  
  if (midtermMet && finalMet && attendanceMet && gradeMet) {
    this.promotionStatus = 'eligible';
  } else {
    this.promotionStatus = 'under_review';
  }
  
  return {
    eligible: this.promotionStatus === 'eligible',
    requirements: {
      midterm: midtermMet,
      final: finalMet,
      attendance: attendanceMet,
      grade: gradeMet
    }
  };
};

// Method to promote student
promotionSchema.methods.promoteStudent = async function() {
  if (this.promotionStatus !== 'eligible') {
    throw new Error('Student is not eligible for promotion');
  }
  
  // Update student's class and grade
  const Student = mongoose.model('Student');
  await Student.findByIdAndUpdate(this.studentId, {
    class: this.nextClass,
    'academicInfo.academicYear': this.academicYear
  });
  
  this.promotionStatus = 'promoted';
  this.promotionDate = new Date();
  
  return this.save();
};

// Static method to process bulk promotions
promotionSchema.statics.processBulkPromotions = async function(classId, academicYear, approvedBy) {
  const eligibleStudents = await this.find({
    currentClass: classId,
    academicYear,
    promotionStatus: 'eligible'
  });
  
  const results = {
    promoted: 0,
    failed: 0,
    errors: []
  };
  
  for (const promotion of eligibleStudents) {
    try {
      promotion.approvedBy = approvedBy._id;
      promotion.approvedByName = approvedBy.name;
      promotion.approvalDate = new Date();
      
      await promotion.promoteStudent();
      results.promoted++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        studentId: promotion.studentId,
        studentName: promotion.studentName,
        error: error.message
      });
    }
  }
  
  return results;
};

export default mongoose.model('Promotion', promotionSchema);