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

// Setup production environment
const setupProduction = async () => {
  try {
    console.log('🚀 Setting up production environment...');
    
    // Clear existing sample data (optional - comment out if you want to keep existing data)
    console.log('🗑️ Clearing sample data...');
    await Grade.deleteMany({ academicYear: '2024-25' }); // Remove sample grades
    await Fee.deleteMany({ academicYear: '2024-25' }); // Remove sample fees
    
    // Create admin user if doesn't exist
    const adminExists = await User.findOne({ email: 'admin@yourschool.com' });
    if (!adminExists) {
      console.log('👤 Creating admin user...');
      const adminUser = new User({
        name: 'School Administrator',
        email: 'admin@yourschool.com',
        password: 'admin123', // Change this password immediately after first login
        role: 'admin'
      });
      await adminUser.save();
      console.log('✅ Admin user created: admin@yourschool.com');
      console.log('⚠️  Default password: admin123 - CHANGE THIS IMMEDIATELY!');
    }

    // Create sample announcement for production
    const existingAnnouncement = await Announcement.findOne({ title: 'Welcome to the School Management System' });
    if (!existingAnnouncement) {
      const welcomeAnnouncement = new Announcement({
        title: 'Welcome to the School Management System',
        content: 'Welcome to your new school management system! This system will help you manage students, teachers, classes, grades, and fees efficiently. Please contact your system administrator for training and support.',
        author: 'System Administrator',
        authorId: (await User.findOne({ role: 'admin' }))._id,
        priority: 'high',
        targetAudience: ['all'],
        category: 'system',
        isActive: true
      });
      await welcomeAnnouncement.save();
      console.log('✅ Welcome announcement created');
    }

    console.log('\n🎉 Production setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Change the admin password after first login');
    console.log('2. Add your school\'s teachers and staff');
    console.log('3. Create your class structure');
    console.log('4. Begin enrolling students');
    console.log('5. Configure email settings for notifications');
    
  } catch (error) {
    console.error('❌ Error setting up production:', error);
  }
};

// Run the setup
const runSetup = async () => {
  await connectDB();
  await setupProduction();
  await mongoose.connection.close();
  console.log('\n✅ Database connection closed');
  process.exit(0);
};

runSetup();