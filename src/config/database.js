const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/operion';

  try {
    const conn = await mongoose.connect(mongoURI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnect error:', error.message);
    throw error;
  }
};

module.exports = { connectDB, disconnectDB };
