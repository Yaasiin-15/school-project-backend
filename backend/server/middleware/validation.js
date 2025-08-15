import { body, validationResult } from 'express-validator';

// Validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
export const validateUserRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['admin', 'teacher', 'student', 'parent', 'accountant'])
    .withMessage('Invalid role specified'),
  handleValidationErrors
];

// User login validation
export const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Student creation validation
export const validateStudentCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('class')
    .notEmpty()
    .withMessage('Class is required'),
  body('rollNumber')
    .notEmpty()
    .withMessage('Roll number is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  handleValidationErrors
];

// Fee creation validation
export const validateFeeCreation = [
  body('studentId')
    .isMongoId()
    .withMessage('Valid student ID is required'),
  body('type')
    .isIn(['tuition', 'transport', 'library', 'lab', 'sports', 'exam', 'other'])
    .withMessage('Invalid fee type'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('dueDate')
    .isISO8601()
    .withMessage('Valid due date is required'),
  handleValidationErrors
];

// Grade creation validation
export const validateGradeCreation = [
  body('studentId')
    .isMongoId()
    .withMessage('Valid student ID is required'),
  body('subjectName')
    .notEmpty()
    .withMessage('Subject name is required'),
  body('score')
    .isFloat({ min: 0 })
    .withMessage('Score must be a positive number'),
  body('maxScore')
    .isFloat({ min: 1 })
    .withMessage('Maximum score must be greater than 0'),
  handleValidationErrors
];

export default {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateStudentCreation,
  validateFeeCreation,
  validateGradeCreation
};