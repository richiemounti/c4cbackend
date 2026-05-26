// middlewares/review.validation.ts
import { Request, Response, NextFunction } from 'express';
import { body, validationResult, param } from 'express-validator';
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

// Validate create review
export const validateCreateReview = [
  body('module')
    .notEmpty()
    .withMessage('Module is required')
    .isIn([
      'stakeholder_group',
      'project_setup',
      'project_site_setup',
      'stakeholder_action',
      'social_impact',
      'toc_consultation_plan',
      'survey',
      'survey_question',
    ])
    .withMessage('Invalid module type'),
  
  body('moduleItemId')
    .notEmpty()
    .withMessage('Module item ID is required')
    .isMongoId()
    .withMessage('Invalid module item ID format'),
  
  body('organizationId')
    .notEmpty()
    .withMessage('Organization ID is required')
    .isMongoId()
    .withMessage('Invalid organization ID format'),
  
  body('projectId')
    .notEmpty()
    .withMessage('Project ID is required')
    .isMongoId()
    .withMessage('Invalid project ID format'),
  
  body('projectSiteId')
    .optional()
    .isMongoId()
    .withMessage('Invalid project site ID format'),
  
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority level'),
  
  body('reviewers')
    .optional()
    .isArray()
    .withMessage('Reviewers must be an array'),
  
  body('reviewers.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid reviewer ID format'),
  
  body('nestedPath')
    .optional()
    .isString()
    .withMessage('Nested path must be a string')
    .trim(),
  
  body('nestedItemId')
    .optional()
    .isString()
    .withMessage('Nested item ID must be a string')
    .trim(),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date format'),
  
  handleValidationErrors
];

// Validate update status
export const validateUpdateStatus = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID format'),
  
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'in_review', 'approved', 'escalated', 'resolved'])
    .withMessage('Invalid status'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters')
    .trim(),
  
  handleValidationErrors
];

// Validate escalate
export const validateEscalate = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID format'),
  
  body('staffAccountManagerId')
    .optional()
    .isMongoId()
    .withMessage('Invalid staff account manager ID format'),
  
  body('reason')
    .notEmpty()
    .withMessage('Escalation reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters')
    .trim(),
  
  handleValidationErrors
];

// Validate add reviewer
export const validateAddReviewer = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID format'),
  
  body('reviewerId')
    .notEmpty()
    .withMessage('Reviewer ID is required')
    .isMongoId()
    .withMessage('Invalid reviewer ID format'),
  
  handleValidationErrors
];

// Validate add issue
export const validateAddIssue = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID format'),
  
  body('field')
    .optional()
    .isString()
    .withMessage('Field must be a string')
    .trim(),
  
  body('issueType')
    .notEmpty()
    .withMessage('Issue type is required')
    .isIn(['validation', 'compliance', 'quality', 'completeness', 'accuracy', 'other'])
    .withMessage('Invalid issue type'),
  
  body('severity')
    .notEmpty()
    .withMessage('Severity is required')
    .isIn(['minor', 'major', 'critical'])
    .withMessage('Invalid severity level'),
  
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters')
    .trim(),
  
  body('suggestedFix')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Suggested fix must not exceed 500 characters')
    .trim(),
  
  handleValidationErrors
];

// Validate resolve issue
export const validateResolveIssue = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID format'),
  
  param('issueId')
    .isMongoId()
    .withMessage('Invalid issue ID format'),
  
  body('resolutionNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Resolution notes must not exceed 500 characters')
    .trim(),
  
  handleValidationErrors
];

export default {
  validateCreateReview,
  validateUpdateStatus,
  validateEscalate,
  validateAddReviewer,
  validateAddIssue,
  validateResolveIssue,
};