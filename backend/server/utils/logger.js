import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.errorFile = path.join(logsDir, 'error.log');
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(logEntry) + '\n';
  }

  writeToFile(filename, content) {
    try {
      fs.appendFileSync(filename, content);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message, meta = {}) {
    const logEntry = this.formatMessage('INFO', message, meta);
    console.log(`ℹ️  ${message}`);
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(this.logFile, logEntry);
    }
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...meta
    } : meta;
    
    const logEntry = this.formatMessage('ERROR', message, errorMeta);
    console.error(`❌ ${message}`, error);
    
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(this.errorFile, logEntry);
    }
  }

  warn(message, meta = {}) {
    const logEntry = this.formatMessage('WARN', message, meta);
    console.warn(`⚠️  ${message}`);
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(this.logFile, logEntry);
    }
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'production') {
      const logEntry = this.formatMessage('DEBUG', message, meta);
      console.debug(`🐛 ${message}`);
    }
  }

  // Log user activities for audit trail
  audit(userId, action, resource, details = {}) {
    const auditEntry = this.formatMessage('AUDIT', `User ${userId} performed ${action} on ${resource}`, {
      userId,
      action,
      resource,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    });
    
    if (process.env.NODE_ENV === 'production') {
      const auditFile = path.join(logsDir, 'audit.log');
      this.writeToFile(auditFile, auditEntry);
    }
  }
}

export default new Logger();