import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Models
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://school_management_system:Yaasiin%402026@cluster0.fvacpn1.mongodb.net/school_management?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create initial admin user only (for production setup)
const createInitialAdmin = async () => {
  try {
    // Check if any admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('✅ Admin user already exists. Skipping creation.');
      return;
    }

    console.log('👤 Creating initial admin user...');
    
    // Get admin credentials from environment variables or use defaults
    const adminData = {
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@school.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin'
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Initial admin user created successfully');
    console.log(`📧 Email: ${adminData.email}`);
    console.log('⚠️  Please change the default password after first login!');
    
    if (!process.env.ADMIN_PASSWORD) {
      console.log('⚠️  Set ADMIN_PASSWORD environment variable for production!');
    }

  } catch (error) {
    console.error('❌ Error creating initial admin:', error);
  }
};

// Run the initial setup
const runInitialSetup = async () => {
  await connectDB();
  await createInitialAdmin();
  await mongoose.connection.close();
  console.log('\n✅ Database connection closed');
  console.log('\n🎉 Production setup complete!');
  console.log('📝 Next steps:');
  console.log('   1. Login with admin credentials');
  console.log('   2. Create school classes and subjects');
  console.log('   3. Add teachers and students');
  console.log('   4. Configure fee structure');
  process.exit(0);
};

runInitialSetup();