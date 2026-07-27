"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateResolveIssue = exports.validateAddIssue = exports.validateAddReviewer = exports.validateEscalate = exports.validateUpdateStatus = exports.validateCreateReview = void 0;
const express_validator_1 = require("express-validator");
// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.data = errors.array();
        throw error;
    }
    next();
};
// Validate create review
exports.validateCreateReview = [
    (0, express_validator_1.body)('module')
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
    (0, express_validator_1.body)('moduleItemId')
        .notEmpty()
        .withMessage('Module item ID is required')
        .isMongoId()
        .withMessage('Invalid module item ID format'),
    (0, express_validator_1.body)('organizationId')
        .notEmpty()
        .withMessage('Organization ID is required')
        .isMongoId()
        .withMessage('Invalid organization ID format'),
    (0, express_validator_1.body)('projectId')
        .notEmpty()
        .withMessage('Project ID is required')
        .isMongoId()
        .withMessage('Invalid project ID format'),
    (0, express_validator_1.body)('projectSiteId')
        .optional()
        .isMongoId()
        .withMessage('Invalid project site ID format'),
    (0, express_validator_1.body)('title')
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 5, max: 200 })
        .withMessage('Title must be between 5 and 200 characters')
        .trim(),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters')
        .trim(),
    (0, express_validator_1.body)('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid priority level'),
    (0, express_validator_1.body)('reviewers')
        .optional()
        .isArray()
        .withMessage('Reviewers must be an array'),
    (0, express_validator_1.body)('reviewers.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid reviewer ID format'),
    (0, express_validator_1.body)('nestedPath')
        .optional()
        .isString()
        .withMessage('Nested path must be a string')
        .trim(),
    (0, express_validator_1.body)('nestedItemId')
        .optional()
        .isString()
        .withMessage('Nested item ID must be a string')
        .trim(),
    (0, express_validator_1.body)('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid due date format'),
    handleValidationErrors
];
// Validate update status
exports.validateUpdateStatus = [
    (0, express_validator_1.param)('reviewId')
        .isMongoId()
        .withMessage('Invalid review ID format'),
    (0, express_validator_1.body)('status')
        .notEmpty()
        .withMessage('Status is required')
        .isIn(['pending', 'in_review', 'approved', 'escalated', 'resolved'])
        .withMessage('Invalid status'),
    (0, express_validator_1.body)('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters')
        .trim(),
    handleValidationErrors
];
// Validate escalate
exports.validateEscalate = [
    (0, express_validator_1.param)('reviewId')
        .isMongoId()
        .withMessage('Invalid review ID format'),
    (0, express_validator_1.body)('staffAccountManagerId')
        .optional()
        .isMongoId()
        .withMessage('Invalid staff account manager ID format'),
    (0, express_validator_1.body)('reason')
        .notEmpty()
        .withMessage('Escalation reason is required')
        .isLength({ min: 10, max: 500 })
        .withMessage('Reason must be between 10 and 500 characters')
        .trim(),
    handleValidationErrors
];
// Validate add reviewer
exports.validateAddReviewer = [
    (0, express_validator_1.param)('reviewId')
        .isMongoId()
        .withMessage('Invalid review ID format'),
    (0, express_validator_1.body)('reviewerId')
        .notEmpty()
        .withMessage('Reviewer ID is required')
        .isMongoId()
        .withMessage('Invalid reviewer ID format'),
    handleValidationErrors
];
// Validate add issue
exports.validateAddIssue = [
    (0, express_validator_1.param)('reviewId')
        .isMongoId()
        .withMessage('Invalid review ID format'),
    (0, express_validator_1.body)('field')
        .optional()
        .isString()
        .withMessage('Field must be a string')
        .trim(),
    (0, express_validator_1.body)('issueType')
        .notEmpty()
        .withMessage('Issue type is required')
        .isIn(['validation', 'compliance', 'quality', 'completeness', 'accuracy', 'other'])
        .withMessage('Invalid issue type'),
    (0, express_validator_1.body)('severity')
        .notEmpty()
        .withMessage('Severity is required')
        .isIn(['minor', 'major', 'critical'])
        .withMessage('Invalid severity level'),
    (0, express_validator_1.body)('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters')
        .trim(),
    (0, express_validator_1.body)('suggestedFix')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Suggested fix must not exceed 500 characters')
        .trim(),
    handleValidationErrors
];
// Validate resolve issue
exports.validateResolveIssue = [
    (0, express_validator_1.param)('reviewId')
        .isMongoId()
        .withMessage('Invalid review ID format'),
    (0, express_validator_1.param)('issueId')
        .isMongoId()
        .withMessage('Invalid issue ID format'),
    (0, express_validator_1.body)('resolutionNotes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Resolution notes must not exceed 500 characters')
        .trim(),
    handleValidationErrors
];
exports.default = {
    validateCreateReview: exports.validateCreateReview,
    validateUpdateStatus: exports.validateUpdateStatus,
    validateEscalate: exports.validateEscalate,
    validateAddReviewer: exports.validateAddReviewer,
    validateAddIssue: exports.validateAddIssue,
    validateResolveIssue: exports.validateResolveIssue,
};
//# sourceMappingURL=review.validation.js.map