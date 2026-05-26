// middlewares/invitation.validation.middleware.ts - UPDATED WITH NEW ROLES
import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { CustomError } from './error.middleware';

// Helper function to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed') as CustomError;
    error.statusCode = 400;
    error.data = errors.array();
    throw error;
  }
  next();
};

// Define invitable client roles (matching user.model.ts)
// Note: 'manager' is excluded because it's typically assigned differently
// ConnectGo roles are also excluded as they're internal staff
const INVITABLE_ROLES = [
  'projectCreator',
  'leadership',
  'hq',
  'communications',
  'fieldStaff',
  'fieldAgent'
] as const;

// Invite User validation
export const validateInviteUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('role')
    .isIn(INVITABLE_ROLES)
    .withMessage(`Invalid role. Must be one of: ${INVITABLE_ROLES.join(', ')}`),
  
  body('organizationId')
    .isMongoId()
    .withMessage('Invalid organization ID format'),
  
  body('projectIds')
    .optional()
    .isArray()
    .withMessage('Project IDs must be an array'),
  
  body('projectIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each project ID must be a valid MongoDB ID'),
  
  handleValidationErrors
];

// Accept Invitation validation
export const validateAcceptInvitation = [
  body('token')
    .notEmpty()
    .withMessage('Invitation token is required')
    .isLength({ min: 10 })
    .withMessage('Invalid token format'),
  
  body('userName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  handleValidationErrors
];

// Update User Profile validation
export const validateUpdateUser = [
  body('userName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('photo')
    .optional()
    .isURL()
    .withMessage('Photo must be a valid URL'),
  
  handleValidationErrors
];

export default {
  validateInviteUser,
  validateAcceptInvitation,
  validateUpdateUser
};