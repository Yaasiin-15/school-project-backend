import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://school_management_system:Yaasiin%402026@cluster0.fvacpn1.mongodb.net/school_management?retryWrites=true&w=majority&appName=Cluster0';

    const options = {
      // Connection options for production
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    // Add additional production options
    if (process.env.NODE_ENV === 'production') {
      options.retryWrites = true;
      options.w = 'majority';
    }

    const conn = await mongoose.connect(mongoURI, options);

    logger.info('Database connected successfully', {
      host: conn.connection.host,
      port: conn.connection.port,
      name: conn.connection.name
    });

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('Database connection error', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Database disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Database reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('Database connection closed through app termination');
        process.exit(0);
      } catch (error) {
        logger.error('Error during database shutdown', error);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    logger.error('Database connection failed', error);
    process.exit(1);
  }
};

export default connectDatabase;