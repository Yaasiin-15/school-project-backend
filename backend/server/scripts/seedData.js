import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import User from '../models/User.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import Grade from '../models/Grade.js';
import Fee from '../models/Fee.js';
import Attendance from '../models/Attendance.js';
import Announcement from '../models/Announcement.js';
import Message from '../models/Message.js';
import Resource from '../models/Resource.js';
import Exam from '../models/Exam.js';
import Promotion from '../models/Promotion.js';
import FeeReminder from '../models/FeeReminder.js';

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔌 Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Student.deleteMany({});
    await Teacher.deleteMany({});
    await Class.deleteMany({});
    await Grade.deleteMany({});
    await Fee.deleteMany({});
    await Attendance.deleteMany({});
    await Announcement.deleteMany({});
    await Message.deleteMany({});
    await Resource.deleteMany({});
    await Exam.deleteMany({});
    await Promotion.deleteMany({});
    await FeeReminder.deleteMany({});
    
    console.log('✅ Cleared existing data');

    // Create Admin User
    console.log('👤 Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@school.edu',
      password: adminPassword,
      role: 'admin',
      isActive: true
    });

    // Create Teachers
    console.log('👨‍🏫 Creating teachers...');
    const teacherPassword = await bcrypt.hash('teacher123', 12);
    const teachers = [];
    
    const teacherData = [
      { name: 'John Smith', email: 'john.smith@school.edu', subjects: ['Mathematics', 'Physics'], department: 'Science' },
      { name: 'Sarah Johnson', email: 'sarah.johnson@school.edu', subjects: ['English', 'Literature'], department: 'Languages' },
      { name: 'Mike Wilson', email: 'mike.wilson@school.edu', subjects: ['History', 'Geography'], department: 'Social Studies' },
      { name: 'Emily Davis', email: 'emily.davis@school.edu', subjects: ['Chemistry', 'Biology'], department: 'Science' },
      { name: 'David Brown', email: 'david.brown@school.edu', subjects: ['Physical Education'], department: 'Sports' },
      { name: 'Lisa Garcia', email: 'lisa.garcia@school.edu', subjects: ['Art', 'Music'], department: 'Arts' },
      { name: 'Robert Martinez', email: 'robert.martinez@school.edu', subjects: ['Computer Science'], department: 'Technology' },
      { name: 'Jennifer Anderson', email: 'jennifer.anderson@school.edu', subjects: ['French', 'Spanish'], department: 'Languages' }
    ];

    for (let i = 0; i < teacherData.length; i++) {
      const teacherUser = await User.create({
        name: teacherData[i].name,
        email: teacherData[i].email,
        password: teacherPassword,
        role: 'teacher',
        isActive: true
      });

      const teacher = await Teacher.create({
        userId: teacherUser._id,
        teacherId: `T${String(i + 1).padStart(3, '0')}`,
        name: teacherData[i].name,
        email: teacherData[i].email,
        subjects: teacherData[i].subjects,
        department: teacherData[i].department,
        qualification: 'Master\'s Degree',
        experience: Math.floor(Math.random() * 10) + 5,
        salary: 50000 + Math.floor(Math.random() * 30000)
      });

      teachers.push(teacher);
    }

    // Create Classes
    console.log('🏫 Creating classes...');
    const classes = [];
    const classData = [
      { name: 'Grade 9-A', section: 'A', grade: '9', subjects: ['Mathematics', 'English', 'Science', 'History', 'Geography'] },
      { name: 'Grade 9-B', section: 'B', grade: '9', subjects: ['Mathematics', 'English', 'Science', 'History', 'Geography'] },
      { name: 'Grade 10-A', section: 'A', grade: '10', subjects: ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology'] },
      { name: 'Grade 10-B', section: 'B', grade: '10', subjects: ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology'] },
      { name: 'Grade 11-A', section: 'A', grade: '11', subjects: ['Advanced Math', 'Literature', 'Physics', 'Chemistry', 'Computer Science'] },
      { name: 'Grade 11-B', section: 'B', grade: '11', subjects: ['Advanced Math', 'Literature', 'Physics', 'Chemistry', 'Computer Science'] },
      { name: 'Grade 12-A', section: 'A', grade: '12', subjects: ['Calculus', 'Advanced Literature', 'Advanced Physics', 'Organic Chemistry'] },
      { name: 'Grade 12-B', section: 'B', grade: '12', subjects: ['Calculus', 'Advanced Literature', 'Advanced Physics', 'Organic Chemistry'] }
    ];

    for (let i = 0; i < classData.length; i++) {
      const classItem = await Class.create({
        name: classData[i].name,
        section: classData[i].section,
        grade: classData[i].grade,
        teacherId: teachers[i % teachers.length]._id,
        teacherName: teachers[i % teachers.length].name,
        subjects: classData[i].subjects,
        room: `Room ${101 + i}`,
        capacity: 30,
        academicYear: '2024-25'
      });

      classes.push(classItem);
    }

    // Create Students
    console.log('👨‍🎓 Creating students...');
    const studentPassword = await bcrypt.hash('student123', 12);
    const students = [];
    
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa', 'Tom', 'Anna', 'Alex', 'Maria', 'James', 'Jessica', 'Daniel', 'Ashley', 'Ryan', 'Amanda', 'Kevin', 'Nicole'];
    const lastNames = ['Smith', 'Johnson', 'Wilson', 'Davis', 'Brown', 'Miller', 'Garcia', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Moore', 'Young', 'Allen', 'King'];

    for (let i = 0; i < 120; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@student.edu`;
      const classIndex = Math.floor(i / 15); // 15 students per class
      const selectedClass = classes[classIndex] || classes[0];

      const studentUser = await User.create({
        name,
        email,
        password: studentPassword,
        role: 'student',
        isActive: true
      });

      const student = await Student.create({
        userId: studentUser._id,
        studentId: `S${String(i + 1).padStart(3, '0')}`,
        name,
        email,
        class: selectedClass.name,
        section: selectedClass.section,
        rollNumber: String((i % 15) + 1).padStart(2, '0'),
        dateOfBirth: new Date(2005 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        phone: `+1-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        address: {
          street: `${Math.floor(Math.random() * 999) + 1} Main St`,
          city: 'Springfield',
          state: 'IL',
          zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
          country: 'USA'
        }
      });

      students.push(student);

      // Add student to class
      await Class.findByIdAndUpdate(selectedClass._id, {
        $push: { students: student._id }
      });
    }

    // Create Grades
    console.log('📝 Creating grades...');
    for (const student of students) {
      const studentClass = classes.find(c => c.name === student.class);
      if (studentClass) {
        for (const subject of studentClass.subjects) {
          // Create multiple grades per subject
          const examTypes = ['quiz', 'assignment', 'midterm', 'final', 'project'];
          for (let i = 0; i < 5; i++) {
            const score = Math.floor(Math.random() * 35) + 65; // 65-100
            await Grade.create({
              studentId: student._id,
              studentName: student.name,
              classId: studentClass._id,
              className: studentClass.name,
              subjectName: subject,
              examType: examTypes[i],
              score,
              maxScore: 100,
              teacherId: studentClass.teacherId,
              teacherName: studentClass.teacherName,
              date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
              term: ['First Term', 'Second Term', 'Third Term'][Math.floor(Math.random() * 3)],
              academicYear: '2024-25',
              weightage: examTypes[i] === 'final' ? 40 : examTypes[i] === 'midterm' ? 30 : 10
            });
          }
        }
      }
    }

    // Create Fees
    console.log('💰 Creating fees...');
    for (const student of students) {
      const feeTypes = ['tuition', 'library', 'lab', 'sports', 'transport'];
      for (const type of feeTypes) {
        const baseAmount = {
          tuition: 8000,
          library: 500,
          lab: 800,
          sports: 300,
          transport: 1200
        };
        
        const amount = baseAmount[type] + Math.floor(Math.random() * 500);
        const isPaid = Math.random() > 0.25; // 75% paid
        const paidAmount = isPaid ? amount : (Math.random() > 0.5 ? Math.floor(amount * 0.5) : 0);
        
        await Fee.create({
          studentId: student._id,
          studentName: student.name,
          studentClass: student.class,
          type,
          amount,
          paidAmount,
          dueDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          paidDate: paidAmount > 0 ? new Date() : null,
          term: 'Spring 2024',
          academicYear: '2024-25',
          paymentMethod: paidAmount > 0 ? ['bank_transfer', 'cash', 'online', 'card'][Math.floor(Math.random() * 4)] : null,
          discount: Math.random() > 0.8 ? Math.floor(Math.random() * 500) : 0
        });
      }
    }

    // Create Attendance Records
    console.log('📅 Creating attendance records...');
    for (const student of students) {
      // Create attendance for last 60 days
      for (let i = 0; i < 60; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        const attendanceRate = 0.92; // 92% attendance rate
        const isPresent = Math.random() < attendanceRate;
        
        await Attendance.create({
          studentId: student._id,
          date,
          status: isPresent ? 'present' : (Math.random() > 0.7 ? 'late' : 'absent'),
          reason: !isPresent ? ['Sick', 'Family emergency', 'Medical appointment', 'Personal'][Math.floor(Math.random() * 4)] : null
        });
      }
    }

    // Create Announcements
    console.log('📢 Creating announcements...');
    const announcements = [
      {
        title: 'Welcome to New Academic Year 2025-26',
        content: 'We welcome all students and faculty to the new academic year. Please check your schedules and be prepared for an exciting year ahead. New policies and procedures have been implemented for better learning experience.',
        author: admin.name,
        authorId: admin._id,
        priority: 'high',
        targetAudience: ['all'],
        category: 'general'
      },
      {
        title: 'Mid-term Examinations Schedule Released',
        content: 'Mid-term examinations will begin from next month. Please prepare accordingly and check the examination timetable on the student portal. Study materials are available in the library.',
        author: admin.name,
        authorId: admin._id,
        priority: 'high',
        targetAudience: ['student', 'teacher'],
        category: 'academic'
      },
      {
        title: 'Parent-Teacher Meeting This Weekend',
        content: 'Parent-teacher meetings are scheduled for this weekend from 9 AM to 5 PM. Please confirm your attendance and book your slots through the parent portal.',
        author: admin.name,
        authorId: admin._id,
        priority: 'medium',
        targetAudience: ['teacher'],
        category: 'meeting'
      },
      {
        title: 'New Library Resources Available',
        content: 'We have added new books and digital resources to our library. Students can now access online databases and e-books through the library portal.',
        author: admin.name,
        authorId: admin._id,
        priority: 'low',
        targetAudience: ['student', 'teacher'],
        category: 'facility'
      },
      {
        title: 'Sports Day Registration Open',
        content: 'Registration for annual sports day is now open. Students can register for various events through the sports department. Last date for registration is next Friday.',
        author: admin.name,
        authorId: admin._id,
        priority: 'medium',
        targetAudience: ['student'],
        category: 'event'
      }
    ];

    for (const announcement of announcements) {
      await Announcement.create(announcement);
    }

    // Create Sample Messages
    console.log('💬 Creating sample messages...');
    const allUsers = [...teachers.map(t => ({ _id: t.userId, name: t.name })), ...students.slice(0, 10).map(s => ({ _id: s.userId, name: s.name }))];
    
    for (let i = 0; i < 50; i++) {
      const sender = allUsers[Math.floor(Math.random() * allUsers.length)];
      const receiver = allUsers[Math.floor(Math.random() * allUsers.length)];
      
      if (sender._id.toString() !== receiver._id.toString()) {
        await Message.create({
          senderId: sender._id,
          receiverId: receiver._id,
          senderName: sender.name,
          receiverName: receiver.name,
          message: [
            'Hello! How are you doing?',
            'Can we schedule a meeting to discuss the project?',
            'Please submit your assignment by tomorrow.',
            'Great work on the presentation!',
            'Do you have any questions about the homework?',
            'The exam results will be announced next week.',
            'Please check the updated schedule.',
            'Thank you for your help with the project.'
          ][Math.floor(Math.random() * 8)],
          isRead: Math.random() > 0.3
        });
      }
    }

    // Create Sample Resources
    console.log('📚 Creating sample resources...');
    const resourceData = [
      { name: 'Mathematics Textbook Chapter 5', type: 'pdf', subject: 'Mathematics', grade: 'Grade 10' },
      { name: 'Science Lab Manual', type: 'pdf', subject: 'Science', grade: 'Grade 9' },
      { name: 'History Timeline Presentation', type: 'presentation', subject: 'History', grade: 'Grade 11' },
      { name: 'English Literature Notes', type: 'document', subject: 'English', grade: 'Grade 12' },
      { name: 'Chemistry Experiment Video', type: 'video', subject: 'Chemistry', grade: 'Grade 10' },
      { name: 'Physics Formula Sheet', type: 'pdf', subject: 'Physics', grade: 'Grade 11' },
      { name: 'Biology Diagrams', type: 'image', subject: 'Biology', grade: 'Grade 10' },
      { name: 'Computer Science Tutorial', type: 'video', subject: 'Computer Science', grade: 'Grade 11' }
    ];

    for (let i = 0; i < resourceData.length; i++) {
      const resource = resourceData[i];
      const teacher = teachers[i % teachers.length];
      
      await Resource.create({
        name: resource.name,
        originalName: `${resource.name}.${resource.type === 'pdf' ? 'pdf' : resource.type === 'video' ? 'mp4' : 'docx'}`,
        type: resource.type,
        mimeType: resource.type === 'pdf' ? 'application/pdf' : resource.type === 'video' ? 'video/mp4' : 'application/msword',
        size: Math.floor(Math.random() * 10000000) + 1000000, // 1-10MB
        filePath: `/uploads/resources/${resource.name.toLowerCase().replace(/\s+/g, '-')}.${resource.type === 'pdf' ? 'pdf' : 'mp4'}`,
        uploadedBy: teacher._id,
        uploadedByName: teacher.name,
        subject: resource.subject,
        grade: resource.grade,
        accessLevel: ['public', 'students', 'teachers'][Math.floor(Math.random() * 3)],
        description: `Educational resource for ${resource.subject} - ${resource.grade}`,
        downloads: Math.floor(Math.random() * 100),
        tags: [resource.subject.toLowerCase(), resource.grade.toLowerCase().replace(/\s+/g, '-')]
      });
    }

    console.log('\n✅ Seed data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`👤 Users: ${await User.countDocuments()}`);
    console.log(`👨‍🎓 Students: ${await Student.countDocuments()}`);
    console.log(`👨‍🏫 Teachers: ${await Teacher.countDocuments()}`);
    console.log(`🏫 Classes: ${await Class.countDocuments()}`);
    console.log(`📝 Grades: ${await Grade.countDocuments()}`);
    console.log(`💰 Fees: ${await Fee.countDocuments()}`);
    console.log(`📅 Attendance: ${await Attendance.countDocuments()}`);
    console.log(`📢 Announcements: ${await Announcement.countDocuments()}`);
    console.log(`💬 Messages: ${await Message.countDocuments()}`);
    console.log(`📚 Resources: ${await Resource.countDocuments()}`);
    
    console.log('\n🔐 Default Login Credentials:');
    console.log('🔹 Admin: admin@school.edu / admin123');
    console.log('🔹 Teacher: john.smith@school.edu / teacher123');
    console.log('🔹 Student: john.smith1@student.edu / student123');
    
    console.log('\n🎯 System is ready for use!');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

seedData();