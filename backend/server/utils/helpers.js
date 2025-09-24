import crypto from 'crypto';

// Generate unique ID with prefix
export const generateId = (prefix = 'ID') => {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${randomStr}`;
};

// Generate student ID
export const generateStudentId = (year = new Date().getFullYear()) => {
  const yearStr = year.toString().slice(-2);
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `STU${yearStr}${randomNum}`;
};

// Generate teacher ID
export const generateTeacherId = () => {
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TCH${randomNum}`;
};

// Generate parent ID
export const generateParentId = () => {
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PAR${randomNum}`;
};

// Format date to readable string
export const formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
};

// Calculate age from date of birth
export const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Calculate grade from percentage
export const calculateGrade = (percentage) => {
  if (percentage >= 97) return { grade: 'A+', gpa: 4.0 };
  if (percentage >= 93) return { grade: 'A', gpa: 4.0 };
  if (percentage >= 90) return { grade: 'A-', gpa: 3.7 };
  if (percentage >= 87) return { grade: 'B+', gpa: 3.3 };
  if (percentage >= 83) return { grade: 'B', gpa: 3.0 };
  if (percentage >= 80) return { grade: 'B-', gpa: 2.7 };
  if (percentage >= 77) return { grade: 'C+', gpa: 2.3 };
  if (percentage >= 73) return { grade: 'C', gpa: 2.0 };
  if (percentage >= 70) return { grade: 'C-', gpa: 1.7 };
  if (percentage >= 67) return { grade: 'D+', gpa: 1.3 };
  if (percentage >= 65) return { grade: 'D', gpa: 1.0 };
  return { grade: 'F', gpa: 0.0 };
};

// Validate email format
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number format
export const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

// Generate random password
export const generatePassword = (length = 8) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Sanitize string for database
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

// Calculate attendance percentage
export const calculateAttendancePercentage = (presentDays, totalDays) => {
  if (totalDays === 0) return 0;
  return Math.round((presentDays / totalDays) * 100);
};

// Get academic year from date
export const getAcademicYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Academic year starts in April (month 3)
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

// Get current term based on date
export const getCurrentTerm = (date = new Date()) => {
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  
  if (month >= 4 && month <= 7) return 'First Term';
  if (month >= 8 && month <= 11) return 'Second Term';
  return 'Third Term';
};

// Format currency
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Generate time slots for timetable
export const generateTimeSlots = (startTime = '08:00', endTime = '16:00', duration = 60) => {
  const slots = [];
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  
  let current = new Date(start);
  
  while (current < end) {
    const slotStart = current.toTimeString().slice(0, 5);
    current.setMinutes(current.getMinutes() + duration);
    const slotEnd = current.toTimeString().slice(0, 5);
    
    slots.push({
      start: slotStart,
      end: slotEnd,
      duration: duration
    });
  }
  
  return slots;
};

// Validate date range
export const isValidDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start <= end;
};

// Get days between two dates
export const getDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Get working days between two dates (excluding weekends)
export const getWorkingDaysBetween = (startDate, endDate, excludeWeekends = true) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workingDays = 0;
  
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
};

// Paginate array
export const paginateArray = (array, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    data: array.slice(startIndex, endIndex),
    pagination: {
      current: page,
      pages: Math.ceil(array.length / limit),
      total: array.length,
      limit
    }
  };
};

// Deep clone object
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Remove sensitive fields from object
export const removeSensitiveFields = (obj, fields = ['password', '__v']) => {
  const cleaned = { ...obj };
  fields.forEach(field => {
    delete cleaned[field];
  });
  return cleaned;
};

// Generate slug from string
export const generateSlug = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Validate required fields
export const validateRequiredFields = (obj, requiredFields) => {
  const missing = [];
  requiredFields.forEach(field => {
    if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
      missing.push(field);
    }
  });
  return missing;
};

// Convert string to title case
export const toTitleCase = (str) => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

// Generate QR code data (placeholder - integrate with QR library)
export const generateQRData = (data) => {
  // This would integrate with a QR code library
  return {
    data,
    qrString: `QR:${JSON.stringify(data)}`,
    timestamp: new Date().toISOString()
  };
};

// Export all utilities
export default {
  generateId,
  generateStudentId,
  generateTeacherId,
  generateParentId,
  formatDate,
  calculateAge,
  calculateGrade,
  isValidEmail,
  isValidPhone,
  generatePassword,
  sanitizeString,
  calculateAttendancePercentage,
  getAcademicYear,
  getCurrentTerm,
  formatCurrency,
  generateTimeSlots,
  isValidDateRange,
  getDaysBetween,
  getWorkingDaysBetween,
  paginateArray,
  deepClone,
  removeSensitiveFields,
  generateSlug,
  validateRequiredFields,
  toTitleCase,
  generateQRData
};