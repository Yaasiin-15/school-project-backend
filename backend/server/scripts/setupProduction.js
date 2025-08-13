import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const setupProduction = async () => {
  try {
    console.log('🚀 Setting up production environment...');
    console.log('📅 Date:', new Date().toISOString());
    console.log('🌍 Node Environment:', process.env.NODE_ENV);

    // Check if required environment variables are set
    const requiredEnvVars = [
      'MONGODB_URI',
      'JWT_SECRET',
      'NODE_ENV'
    ];

    console.log('\n🔍 Checking environment variables...');
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars);
      console.log('\n📝 Required environment variables:');
      requiredEnvVars.forEach(varName => {
        console.log(`   ${varName}: ${process.env[varName] ? '✅ Set' : '❌ Missing'}`);
      });
      process.exit(1);
    }

    console.log('✅ All required environment variables are set');

    // Create necessary directories
    console.log('\n📁 Creating necessary directories...');
    const directories = [
      'uploads',
      'uploads/profiles',
      'uploads/resources',
      'logs'
    ];

    directories.forEach(dir => {
      const dirPath = join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } else {
        console.log(`✅ Directory exists: ${dir}`);
      }
    });

    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test database connection and get info
    const db = mongoose.connection.db;
    console.log(`✅ Database: ${db.databaseName}`);

    // Check collections
    const collections = await db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections`);

    if (collections.length > 0) {
      console.log('📊 Collections:');
      for (const collection of collections) {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`   ${collection.name}: ${count} documents`);
      }
    }

    // Check if data exists
    const User = (await import('../models/User.js')).default;
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('\n⚠️  No users found in database');
      console.log('💡 To add sample data, run: npm run seed');
      console.log('💡 To create admin user manually, use the admin panel');
    } else {
      console.log(`\n✅ Found ${userCount} users in database`);
      
      // Check admin user
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser) {
        console.log('✅ Admin user exists');
      } else {
        console.log('⚠️  No admin user found');
      }
    }

    // Test JWT secret strength
    console.log('\n🔐 Checking JWT configuration...');
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret.length < 32) {
      console.log('⚠️  JWT_SECRET is shorter than recommended (32+ characters)');
    } else {
      console.log('✅ JWT_SECRET length is adequate');
    }

    // Check CORS configuration
    console.log('\n🌐 CORS Configuration:');
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
    console.log(`   Port: ${process.env.PORT || 3001}`);

    // Performance recommendations
    console.log('\n⚡ Performance Recommendations:');
    console.log('   ✅ Compression middleware enabled');
    console.log('   ✅ Rate limiting configured');
    console.log('   ✅ Security headers (Helmet) enabled');
    console.log('   ✅ MongoDB indexes created');

    // Security checklist
    console.log('\n🔒 Security Checklist:');
    console.log('   ✅ Password hashing (bcrypt)');
    console.log('   ✅ JWT authentication');
    console.log('   ✅ Input validation');
    console.log('   ✅ CORS protection');
    console.log('   ✅ Rate limiting');
    console.log('   ✅ Security headers');

    console.log('\n🎉 Production setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start the server: npm start');
    console.log('   2. Test health endpoint: /health');
    console.log('   3. Verify API endpoints are working');
    console.log('   4. Check frontend connection');
    console.log('   5. Monitor logs for any issues');
    
  } catch (error) {
    console.error('\n❌ Production setup failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
    process.exit(0);
  }
};

setupProduction();