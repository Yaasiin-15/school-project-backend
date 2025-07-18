import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Models
import User from '../models/User.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import Grade from '../models/Grade.js';
import Fee from '../models/Fee.js';
import Announcement from '../models/Announcement.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school_management');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample data
const sampleUsers = [
  {
    name: 'Admin User',
    email: 'admin@school.com',
    password: 'password123',
    role: 'admin'
  },
  {
    name: 'John Smith',
    email: 'john.smith@school.com',
    password: 'teacher123',
    role: 'teacher',
    teacherId: 'T001'
  },
  {
    name: 'Maria Garcia',
    email: 'maria.garcia@school.com',
    password: 'teacher123',
    role: 'teacher',
    teacherId: 'T002'
  },
  {
    name: 'David Lee',
    email: 'david.lee@school.com',
    password: 'teacher123',
    role: 'teacher',
    teacherId: 'T003'
  },
  {
    name: 'Emma Johnson',
    email: 'emma.johnson@school.com',
    password: 'student123',
    role: 'student',
    studentId: 'S001'
  },
  {
    name: 'Michael Chen',
    email: 'michael.chen@school.com',
    password: 'student123',
    role: 'student',
    studentId: 'S002'
  },
  {
    name: 'Sarah Wilson',
    email: 'sarah.wilson@school.com',
    password: 'student123',
    role: 'student',
    studentId: 'S003'
  },
  {
    name: 'Alex Rodriguez',
    email: 'alex.rodriguez@school.com',
    password: 'student123',
    role: 'student',
    studentId: 'S004'
  },
  {
    name: 'Finance Manager',
    email: 'finance@school.com',
    password: 'accountant123',
    role: 'accountant',
    accountantId: 'A001'
  }
];

const sampleTeachers = [
  {
    teacherId: 'T001',
    name: 'John Smith',
    email: 'john.smith@school.com',
    phone: '+1234567891',
    subjects: ['Mathematics', 'Physics'],
    classes: ['10A', '11B'],
    qualification: 'M.Sc Mathematics',
    experience: 8,
    department: 'Science',
    salary: 55000
  },
  {
    teacherId: 'T002',
    name: 'Maria Garcia',
    email: 'maria.garcia@school.com',
    phone: '+1234567892',
    subjects: ['Chemistry', 'Biology'],
    classes: ['10A', '10B'],
    qualification: 'M.Sc Chemistry',
    experience: 6,
    department: 'Science',
    salary: 52000
  },
  {
    teacherId: 'T003',
    name: 'David Lee',
    email: 'david.lee@school.com',
    phone: '+1234567893',
    subjects: ['English', 'Literature'],
    classes: ['11A', '11B'],
    qualification: 'M.A English',
    experience: 10,
    department: 'Arts',
    salary: 58000
  }
];

const sampleStudents = [
  {
    studentId: 'S001',
    name: 'Emma Johnson',
    email: 'emma.johnson@school.com',
    class: 'Class 10A',
    section: 'A',
    rollNumber: '001',
    dateOfBirth: new Date('2008-05-15'),
    phone: '+1234567894',
    emergencyContact: '+1234567894',
    parentInfo: {
      fatherName: 'Robert Johnson',
      motherName: 'Lisa Johnson',
      guardianPhone: '+1234567894',
      guardianEmail: 'robert.johnson@email.com'
    }
  },
  {
    studentId: 'S002',
    name: 'Michael Chen',
    email: 'michael.chen@school.com',
    class: 'Class 10A',
    section: 'A',
    rollNumber: '002',
    dateOfBirth: new Date('2008-03-22'),
    phone: '+1234567895',
    emergencyContact: '+1234567895',
    parentInfo: {
      fatherName: 'David Chen',
      motherName: 'Amy Chen',
      guardianPhone: '+1234567895',
      guardianEmail: 'david.chen@email.com'
    }
  },
  {
    studentId: 'S003',
    name: 'Sarah Wilson',
    email: 'sarah.wilson@school.com',
    class: 'Class 11B',
    section: 'B',
    rollNumber: '003',
    dateOfBirth: new Date('2007-08-10'),
    phone: '+1234567896',
    emergencyContact: '+1234567896',
    parentInfo: {
      fatherName: 'Mark Wilson',
      motherName: 'Jennifer Wilson',
      guardianPhone: '+1234567896',
      guardianEmail: 'mark.wilson@email.com'
    }
  },
  {
    studentId: 'S004',
    name: 'Alex Rodriguez',
    email: 'alex.rodriguez@school.com',
    class: 'Class 11A',
    section: 'A',
    rollNumber: '004',
    dateOfBirth: new Date('2007-12-03'),
    phone: '+1234567897',
    emergencyContact: '+1234567897',
    parentInfo: {
      fatherName: 'Carlos Rodriguez',
      motherName: 'Sofia Rodriguez',
      guardianPhone: '+1234567897',
      guardianEmail: 'carlos.rodriguez@email.com'
    }
  }
];

const sampleClasses = [
  {
    name: 'Class 10A',
    section: 'A',
    grade: '10',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
    room: 'Room 101',
    capacity: 40,
    academicYear: '2024-25'
  },
  {
    name: 'Class 10B',
    section: 'B',
    grade: '10',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
    room: 'Room 102',
    capacity: 40,
    academicYear: '2024-25'
  },
  {
    name: 'Class 11A',
    section: 'A',
    grade: '11',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
    room: 'Room 201',
    capacity: 40,
    academicYear: '2024-25'
  },
  {
    name: 'Class 11B',
    section: 'B',
    grade: '11',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
    room: 'Room 202',
    capacity: 40,
    academicYear: '2024-25'
  }
];

const seedDatabase = async () => {
  try {
    // Clear existing data
    console.log('🗑️ Clearing existing data...');
    await User.deleteMany({});
    await Student.deleteMany({});
    await Teacher.deleteMany({});
    await Class.deleteMany({});
    await Grade.deleteMany({});
    await Fee.deleteMany({});
    await Announcement.deleteMany({});

    // Create users
    console.log('👥 Creating users...');
    const users = [];
    for (const userData of sampleUsers) {
      // Don't hash password here - let the User model's pre-save hook handle it
      const user = new User({
        ...userData
      });

      const savedUser = await user.save();
      users.push(savedUser);
      console.log(`✅ Created user: ${userData.name} (${userData.role})`);
    }

    // Create teachers
    console.log('👨‍🏫 Creating teachers...');
    const teachers = [];
    for (const teacherData of sampleTeachers) {
      const user = users.find(u => u.email === teacherData.email);
      const teacher = new Teacher({
        ...teacherData,
        userId: user._id
      });
      const savedTeacher = await teacher.save();
      teachers.push(savedTeacher);
      console.log(`✅ Created teacher: ${teacherData.name}`);
    }

    // Create students
    console.log('👨‍🎓 Creating students...');
    const students = [];
    for (const studentData of sampleStudents) {
      const user = users.find(u => u.email === studentData.email);
      const student = new Student({
        ...studentData,
        userId: user._id
      });
      const savedStudent = await student.save();
      students.push(savedStudent);
      console.log(`✅ Created student: ${studentData.name}`);
    }

    // Create classes and assign teachers/students
    console.log('🏫 Creating classes...');
    const classes = [];
    for (let i = 0; i < sampleClasses.length; i++) {
      const classData = sampleClasses[i];
      const teacher = teachers[i % teachers.length];

      const classObj = new Class({
        ...classData,
        teacherId: teacher._id,
        teacherName: teacher.name
      });

      // Assign students to classes based on their class property
      const classStudents = students.filter(s => {
        // Match class names more flexibly
        const studentClass = s.class.toLowerCase().replace(/\s+/g, '');
        const targetClass = classData.name.toLowerCase().replace(/\s+/g, '');
        return studentClass === targetClass;
      });
      
      classObj.students = classStudents.map(s => s._id);
      classObj.studentCount = classStudents.length;

      const savedClass = await classObj.save();
      classes.push(savedClass);
      console.log(`✅ Created class: ${classData.name} with ${classStudents.length} students`);
      
      // Update students to reference the class
      for (const student of classStudents) {
        student.classId = savedClass._id;
        await student.save();
      }
    }

    // Create sample grades
    console.log('📊 Creating sample grades...');
    const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
    const examTypes = ['quiz', 'assignment', 'midterm', 'final'];
    const terms = ['First Term', 'Second Term'];

    for (const student of students) {
      const studentClass = classes.find(c => c.name === student.class);
      if (!studentClass) continue;

      for (const subject of subjects) {
        for (const term of terms) {
          for (const examType of examTypes) {
            const score = Math.floor(Math.random() * 40) + 60; // Random score between 60-100
            const maxScore = 100;

            const grade = new Grade({
              studentId: student._id,
              studentName: student.name,
              classId: studentClass._id,
              className: student.class,
              subjectName: subject,
              examType,
              score,
              maxScore,
              teacherId: studentClass.teacherId,
              teacherName: studentClass.teacherName,
              date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
              term,
              academicYear: '2024-25'
            });

            await grade.save();
          }
        }
      }
      console.log(`✅ Created grades for student: ${student.name}`);
    }

    // Create sample fees
    console.log('💰 Creating sample fees...');
    const feeTypes = ['tuition', 'transport', 'library', 'lab', 'sports'];
    const feeTerms = ['Spring 2024', 'Summer 2024', 'Fall 2024'];

    for (const student of students) {
      for (const term of feeTerms) {
        for (const feeType of feeTypes) {
          const amount = feeType === 'tuition' ? 2500 :
            feeType === 'transport' ? 300 :
              feeType === 'lab' ? 150 : 100;

          const paidAmount = Math.random() > 0.3 ? amount : Math.floor(amount * Math.random());

          const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now() + Math.random() * 1000).slice(-8)}`;

          const fee = new Fee({
            studentId: student._id,
            studentName: student.name,
            studentClass: student.class,
            type: feeType,
            amount,
            paidAmount,
            dueDate: new Date(2024, Math.floor(Math.random() * 12), 15),
            term,
            academicYear: '2024-25',
            invoiceNumber,
            paymentMethod: paidAmount > 0 ? 'card' : undefined,
            transactionId: paidAmount > 0 ? `TXN${Math.random().toString(36).substr(2, 9).toUpperCase()}` : undefined
          });

          await fee.save();
        }
      }
      console.log(`✅ Created fees for student: ${student.name}`);
    }

    // Create sample announcements
    console.log('📢 Creating sample announcements...');
    const announcements = [
      {
        title: 'Mid-term Examinations Schedule',
        content: 'Mid-term examinations will commence from July 15th, 2025. Please check your individual timetables for specific dates and times. All students must bring their ID cards and required stationery.',
        author: 'Admin User',
        authorId: users.find(u => u.role === 'admin')._id,
        priority: 'high',
        targetAudience: ['student', 'teacher', 'parent'],
        category: 'academic',
        isActive: true
      },
      {
        title: 'Parent-Teacher Meeting',
        content: 'Monthly parent-teacher meeting is scheduled for January 30th, 2024, from 2:00 PM to 5:00 PM. Please confirm your attendance by January 28th.',
        author: 'Admin User',
        authorId: users.find(u => u.role === 'admin')._id,
        priority: 'medium',
        targetAudience: ['parent', 'teacher'],
        category: 'meeting',
        isActive: true
      },
      {
        title: 'Science Fair 2024',
        content: 'Annual Science Fair will be held on March 15th, 2024. Students are encouraged to participate and showcase their innovative projects. Registration deadline is February 28th.',
        author: 'Admin User',
        authorId: users.find(u => u.role === 'admin')._id,
        priority: 'medium',
        targetAudience: ['student', 'teacher', 'parent'],
        category: 'event',
        isActive: true,
        expiryDate: new Date('2024-03-16')
      },
      {
        title: 'Library Hours Update',
        content: 'Starting next week, library hours will be extended until 8:00 PM on weekdays to accommodate more study time for students.',
        author: 'Admin User',
        authorId: users.find(u => u.role === 'admin')._id,
        priority: 'low',
        targetAudience: ['all'],
        category: 'facility',
        isActive: true
      }
    ];

    for (const announcementData of announcements) {
      const announcement = new Announcement(announcementData);
      await announcement.save();
      console.log(`✅ Created announcement: ${announcementData.title}`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Initial System Setup Complete');
    console.log('✅ Admin account created: admin@school.com');
    console.log('✅ Sample teachers, students, and classes created');
    console.log('✅ Academic records and fee structure initialized');
    console.log('\n⚠️  Please change default passwords after first login!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
};

// Run the seeder
const runSeeder = async () => {
  await connectDB();
  await seedDatabase();
  await mongoose.connection.close();
  console.log('\n✅ Database connection closed');
  process.exit(0);
};

runSeeder();